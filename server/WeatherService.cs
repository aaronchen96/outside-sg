using System.Text.Json;

namespace Outside.Api;

public sealed class WeatherService(IHttpClientFactory factory, ILogger<WeatherService> logger)
{
    private sealed record Cached(JsonElement Data, DateTimeOffset FetchedAt, DateTimeOffset? UpdatedAt, bool Failed);
    private readonly Dictionary<string, Cached> cache = new();
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private DateTimeOffset nextRefresh = DateTimeOffset.MinValue;
    private static readonly (string Path, string Name)[] Endpoints = [("two-hr-forecast", "2-hour area forecast"), ("twenty-four-hr-forecast", "24-hour outlook"), ("rainfall", "Rainfall observations"), ("air-temperature", "Air temperature observations"), ("relative-humidity", "Relative humidity observations")];
    private static string? S(JsonElement e, string key) => e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static double? N(JsonElement e, string key) => e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var n) && double.IsFinite(n) ? n : null;
    private static DateTimeOffset? T(string? text) => DateTimeOffset.TryParse(text, out var t) ? t : null;
    private static JsonElement? Latest(JsonElement data, string key, string timestamp)
        => data.TryGetProperty(key, out var a) && a.ValueKind == JsonValueKind.Array ? a.EnumerateArray().OrderByDescending(x => T(S(x, timestamp))).Select(x => (JsonElement?)x).FirstOrDefault() : null;

    private async Task Refresh(CancellationToken cancellationToken)
    {
        if (DateTimeOffset.UtcNow < nextRefresh)
            return;
        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (DateTimeOffset.UtcNow < nextRefresh)
                return;
            var tasks = Endpoints.Select(async endpoint =>
            {
                try
                {
                    using var response = await factory.CreateClient("weather").GetAsync(endpoint.Path, cancellationToken);
                    response.EnsureSuccessStatusCode();
                    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                    using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
                    var root = document.RootElement;
                    if (root.GetProperty("code").GetInt32() != 0)
                        throw new JsonException("Upstream returned an error code.");
                    var data = root.GetProperty("data").Clone();
                    var record = endpoint.Path switch
                    {
                        "two-hr-forecast" => Latest(data, "items", "timestamp"),
                        "twenty-four-hr-forecast" => Latest(data, "records", "timestamp"),
                        _ => Latest(data, "readings", "timestamp")
                    };
                    if (record is null)
                        throw new JsonException("No records in upstream response.");
                    Validate(endpoint.Path, data, record.Value);
                    return (endpoint.Path, Result: (Cached?)new Cached(data, DateTimeOffset.UtcNow, T(S(record.Value, "timestamp")), false));
                }
                catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException or KeyNotFoundException or InvalidOperationException or FormatException)
                {
                    logger.LogWarning("Weather source {Source} unavailable ({ErrorType})", endpoint.Path, ex.GetType().Name);
                    return (endpoint.Path, Result: (Cached?)null);
                }
            });
            foreach (var (path, result) in await Task.WhenAll(tasks))
            {
                if (result is not null)
                    cache[path] = result;
                else if (cache.TryGetValue(path, out var previous))
                    cache[path] = previous with
                    {
                        Failed = true
                    };
            }
            nextRefresh = DateTimeOffset.UtcNow.AddMinutes(5);
        }
        finally { refreshLock.Release(); }
    }

    private string SourceStatus(string path, DateTimeOffset now)
    {
        if (!cache.TryGetValue(path, out var c))
            return "unavailable";
        if (c.Failed || c.UpdatedAt is null || c.UpdatedAt > now.AddMinutes(5))
            return "stale";
        if (path == "two-hr-forecast")
        {
            var r = Latest(c.Data, "items", "timestamp");
            if (r is null || !r.Value.TryGetProperty("valid_period", out var period) || T(S(period, "start")) is not { } start || T(S(period, "end")) is not { } end || now < start || now >= end)
                return "stale";
        }
        else if (path == "twenty-four-hr-forecast")
        {
            var r = Latest(c.Data, "records", "timestamp");
            if (r is null || !r.Value.TryGetProperty("general", out var general) || !general.TryGetProperty("validPeriod", out var period) || T(S(period, "end")) is not { } end || now >= end || now - c.UpdatedAt > TimeSpan.FromHours(24))
                return "stale";
        }
        else if (now - c.UpdatedAt > TimeSpan.FromMinutes(30))
            return "stale";
        return "live";
    }

    public async Task<Dashboard> GetDashboard(string activity, string region, CancellationToken cancellationToken)
    {
        await Refresh(cancellationToken);
        // Refresh mutates the dictionary under a lock; readers copy the immutable cached records under the same lock.
        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            var now = DateTimeOffset.UtcNow;
            var sources = Endpoints.Select(e => new Source(e.Name, $"https://api-open.data.gov.sg/v2/real-time/api/{e.Path}", SourceStatus(e.Path, now), cache.GetValueOrDefault(e.Path)?.UpdatedAt?.ToString("O"))).ToArray();
            var status = sources.All(x => x.Status == "live") ? "live" : sources.All(x => x.Status == "unavailable") ? "unavailable" : "stale";
            var two = cache.TryGetValue("two-hr-forecast", out var twoCache) ? Latest(twoCache.Data, "items", "timestamp") : null;
            ForecastWindow? window = null;
            if (two is { } t && t.TryGetProperty("valid_period", out var v))
                window = new(S(v, "start") ?? "", S(v, "end") ?? "");
            var summary = new Summary(null, null, null, null, null);
            var periods = new List<Period>();
            if (cache.TryGetValue("twenty-four-hr-forecast", out var dailyCache) && Latest(dailyCache.Data, "records", "timestamp") is { } daily)
            {
                var general = daily.GetProperty("general");
                var temp = general.GetProperty("temperature");
                var humidity = general.GetProperty("relativeHumidity");
                summary = new(N(temp, "low"), N(temp, "high"), N(humidity, "low"), N(humidity, "high"), S(general.GetProperty("forecast"), "text"));
                foreach (var p in daily.GetProperty("periods").EnumerateArray())
                {
                    var time = p.GetProperty("timePeriod");
                    var regions = p.GetProperty("regions");
                    var text = region != "all" ? S(regions.GetProperty(region), "text") : string.Join(" · ", regions.EnumerateObject().Select(x => S(x.Value, "text")).Distinct());
                    periods.Add(new(S(time, "start") ?? "", S(time, "end") ?? "", text ?? "Unavailable"));
                }
            }
            var destinations = Catalog.Destinations.Where(d => d.Activities.Contains(activity) && (region == "all" || d.Region == region)).Select(d =>
            {
                string? forecast = null, area = null;
                if (two is { } f && twoCache is not null)
                {
                    var nearest = twoCache.Data.GetProperty("area_metadata").EnumerateArray().OrderBy(a => Distance(d.Latitude, d.Longitude, a.GetProperty("label_location").GetProperty("latitude").GetDouble(), a.GetProperty("label_location").GetProperty("longitude").GetDouble())).FirstOrDefault();
                    area = S(nearest, "name");
                    foreach (var prediction in f.GetProperty("forecasts").EnumerateArray())
                    if (S(prediction, "area") == area)
                        forecast = S(prediction, "forecast");
                }
                var rain = Nearest("rainfall", d, "mm");
                var temp = Nearest("air-temperature", d, "°C");
                var humidity = Nearest("relative-humidity", d, "%");
                var essentialFresh = SourceStatus("two-hr-forecast", now) == "live" && SourceStatus("rainfall", now) == "live" && SourceStatus("air-temperature", now) == "live";
                var (score, verdict, reasons) = Score(forecast, rain, temp, humidity, activity, essentialFresh);
                return new DestinationWeather(d.Id, d.Name, d.Region, d.Description, d.Latitude, d.Longitude, d.Activities, d.Tags, forecast, area, score, verdict, reasons, rain, temp, humidity, d.MapLocation);
            }).OrderByDescending(d => d.Score ?? -1).ThenBy(d => d.Name).ToArray();
            return new(sources.Select(s => T(s.UpdatedAt)).Where(t => t is not null).Max()?.ToString("O"), now.ToString("O"), status,
                status == "live" ? null : status == "unavailable" ? "Weather services are unavailable. No weather values have been invented. Try again in a few minutes." : "Some sources are delayed or unavailable. Check source timestamps; recommendations are withheld when essential data is not current.",
                window, summary, periods.ToArray(), destinations, sources);
        }
        finally { refreshLock.Release(); }
    }

    private Observation? Nearest(string path, Destination destination, string unit)
    {
        if (!cache.TryGetValue(path, out var c) || Latest(c.Data, "readings", "timestamp") is not { } reading)
            return null;
        var values = reading.GetProperty("data").EnumerateArray().Where(x => N(x, "value") is not null).ToDictionary(x => S(x, "stationId")!, x => N(x, "value")!.Value);
        var stations = c.Data.GetProperty("stations").EnumerateArray().Where(s => S(s, "id") is { } id && values.ContainsKey(id)).Select(s =>
        {
            var l = s.GetProperty("location");
            return (Station: s, Distance: Distance(destination.Latitude, destination.Longitude, l.GetProperty("latitude").GetDouble(), l.GetProperty("longitude").GetDouble()));
        }).OrderBy(s => s.Distance).ToArray();
        if (stations.Length == 0 || stations[0].Distance > 20)
            return null;
        var nearest = stations[0];
        return new(values[S(nearest.Station, "id")!], unit, S(nearest.Station, "name") ?? "Unknown station", Math.Round(nearest.Distance, 1), S(reading, "timestamp") ?? "");
    }
    private static (int? Score, string Verdict, string[] Reasons) Score(string? forecast, Observation? rain, Observation? temperature, Observation? humidity, string activity, bool fresh)
    {
        if (!fresh || forecast is null || rain is null || temperature is null)
            return (null, "Awaiting current data", ["A current area forecast, rainfall reading and temperature reading are required for a recommendation."]);
        var score = 90;
        var reasons = new List<string>();
        var f = forecast.ToLowerInvariant();
        if (f.Contains("thunder"))
        {
            score -= 70;
            reasons.Add("Thunderstorms are forecast: postpone exposed outdoor activities and check official lightning advice.");
        }
        else if (f.Contains("rain") || f.Contains("shower"))
        {
            score -= 40;
            reasons.Add("Rain or showers are forecast in this area.");
        }
        else if (f.Contains("hazy") || f.Contains("haze"))
        {
            score -= 35;
            reasons.Add("Hazy conditions are forecast; check official air quality guidance.");
        }
        else if (f.Contains("cloud"))
            reasons.Add("Cloudy conditions are forecast for this area.");
        else
            reasons.Add("The area forecast does not mention rain or thunderstorms.");
        if (rain.Value > 0)
        {
            score -= rain.Value >= 2 ? 30 : 15;
            reasons.Add($"Nearby rainfall station recorded {rain.Value:0.0} mm in its latest 5-minute interval; this is an observation, not a prediction.");
        }
        else
            reasons.Add("No rain recorded in the nearby station's latest 5-minute interval.");
        if (temperature.Value >= 32)
        {
            score -= activity is "run" or "cycle" ? 20 : 10;
            reasons.Add("Nearby temperature is at least 32°C; plan shade, water and rest breaks.");
        }
        else if (temperature.Value >= 30)
        {
            score -= 5;
            reasons.Add("Nearby temperature is at least 30°C; bring water.");
        }
        if (humidity is not null && T(humidity.Timestamp) is { } humidityTime && humidityTime <= DateTimeOffset.UtcNow.AddMinutes(5) && DateTimeOffset.UtcNow - humidityTime <= TimeSpan.FromMinutes(30) && humidity.Value >= 85)
        {
            score -= 5;
            reasons.Add("Nearby humidity is at least 85%, which may feel less comfortable.");
        }
        if (humidity is null)
            reasons.Add("Humidity data is unavailable and is excluded from this score.");
        if (activity == "picnic" && rain.Value > 0)
        {
            score -= 10;
            reasons.Add("Recent rain may leave picnic areas wet.");
        }
        score = Math.Clamp(score, 0, 100);
        return (score, score >= 75 ? "Good conditions" : score >= 50 ? "Plan with care" : "Consider postponing", reasons.ToArray());
    }
    private static double Distance(double lat1, double lon1, double lat2, double lon2)
    {
        const double radians = Math.PI / 180;
        var dlat = (lat2 - lat1) * radians;
        var dlon = (lon2 - lon1) * radians;
        var a = Math.Pow(Math.Sin(dlat / 2), 2) + Math.Cos(lat1 * radians) * Math.Cos(lat2 * radians) * Math.Pow(Math.Sin(dlon / 2), 2);
        return 6371 * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    // Reject structurally invalid feeds before replacing the last successful snapshot.
    private static void Validate(string path, JsonElement data, JsonElement record)
    {
        if (T(S(record, "timestamp")) is null)
            throw new JsonException("Invalid timestamp.");
        static void Array(JsonElement e, string key)
        {
            if (e.GetProperty(key).ValueKind != JsonValueKind.Array)
                throw new JsonException("Expected an array.");
        }
        static void Text(JsonElement e, string key)
        {
            if (string.IsNullOrWhiteSpace(S(e, key)))
                throw new JsonException("Expected text.");
        }
        static void Number(JsonElement e, string key)
        {
            if (N(e, key) is null)
                throw new JsonException("Expected a number.");
        }
        static void Window(JsonElement e)
        {
            if (T(S(e, "start")) is not { } start || T(S(e, "end")) is not { } end || start >= end)
                throw new JsonException("Invalid validity window.");
        }
        if (path == "two-hr-forecast")
        {
            Array(data, "area_metadata");
            Array(record, "forecasts");
            Window(record.GetProperty("valid_period"));
            if (data.GetProperty("area_metadata").GetArrayLength() == 0 || record.GetProperty("forecasts").GetArrayLength() == 0)
                throw new JsonException("Empty area forecast.");
            foreach (var area in data.GetProperty("area_metadata").EnumerateArray())
            {
                Text(area, "name");
                var location = area.GetProperty("label_location");
                Number(location, "latitude");
                Number(location, "longitude");
            }
            foreach (var f in record.GetProperty("forecasts").EnumerateArray())
            {
                Text(f, "area");
                Text(f, "forecast");
            }
        }
        else if (path == "twenty-four-hr-forecast")
        {
            var g = record.GetProperty("general");
            Window(g.GetProperty("validPeriod"));
            Text(g.GetProperty("forecast"), "text");
            foreach (var key in new[] { "temperature", "relativeHumidity" })
            {
                Number(g.GetProperty(key), "low");
                Number(g.GetProperty(key), "high");
            }
            Array(record, "periods");
            foreach (var p in record.GetProperty("periods").EnumerateArray())
            {
                Window(p.GetProperty("timePeriod"));
                foreach (var region in Catalog.Regions.Where(r => r != "all"))
                    Text(p.GetProperty("regions").GetProperty(region), "text");
            }
        }
        else
        {
            Array(data, "stations");
            Array(record, "data");
            foreach (var station in data.GetProperty("stations").EnumerateArray())
            {
                Text(station, "id");
                Text(station, "name");
                Number(station.GetProperty("location"), "latitude");
                Number(station.GetProperty("location"), "longitude");
            }
            var ids = new HashSet<string>();
            foreach (var reading in record.GetProperty("data").EnumerateArray())
            {
                Text(reading, "stationId");
                if (!ids.Add(S(reading, "stationId")!))
                    throw new JsonException("Duplicate reading.");
            }
        }
    }
}
