using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Outside.Api;

namespace Outside.Api.Tests;

public sealed class ManualClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-11-14T02:00:00Z");
    public override DateTimeOffset GetUtcNow() => Now;
}

public sealed class WeatherFeed(ManualClock clock) : HttpMessageHandler
{
    public ConcurrentDictionary<string, int> Calls { get; } = new();
    public HashSet<string> FailedPaths { get; } = [];
    public string Forecast { get; set; } = "Fair";
    public double Rainfall { get; set; }
    public double Temperature { get; set; } = 28;
    public double Humidity { get; set; } = 70;
    public TimeSpan ReadingAge { get; set; }
    public bool ExpiredForecast { get; set; }
    public bool Malformed { get; set; }
    public bool DistantStations { get; set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var path = request.RequestUri!.Segments.Last();
        Calls.AddOrUpdate(path, 1, (_, count) => count + 1);
        if (FailedPaths.Contains(path))
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var body = Malformed ? "{bad json" : JsonSerializer.Serialize(new { code = 0, data = Data(path) });
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });
    }

    private object Data(string path)
    {
        var now = clock.Now;
        var start = now.AddMinutes(ExpiredForecast ? -180 : -5).ToString("O");
        var end = now.AddMinutes(ExpiredForecast ? -60 : 115).ToString("O");
        if (path == "two-hr-forecast")
            return new
            {
                area_metadata = Catalog.Destinations.Select(d => new
                {
                    name = d.Id,
                    label_location = new { latitude = d.Latitude, longitude = d.Longitude }
                }),
                items = new[] { new
                {
                    timestamp = now.ToString("O"), valid_period = new { start, end },
                    forecasts = Catalog.Destinations.Select(d => new { area = d.Id, forecast = Forecast })
                } }
            };
        if (path == "twenty-four-hr-forecast")
            return new { records = new[] { new
            {
                timestamp = now.ToString("O"),
                general = new
                {
                    validPeriod = new { start, end = now.AddHours(24).ToString("O") },
                    temperature = new { low = 25, high = 32 },
                    relativeHumidity = new { low = 60, high = 95 },
                    forecast = new { text = Forecast }
                },
                periods = new[] { new
                {
                    timePeriod = new { start, end },
                    regions = Catalog.Regions.Where(r => r != "all").ToDictionary(r => r, _ => new { text = Forecast })
                } }
            } } };
        var value = path switch { "rainfall" => Rainfall, "air-temperature" => Temperature, _ => Humidity };
        return new
        {
            stations = Catalog.Destinations.Select(d => new
            {
                id = d.Id, name = d.Name,
                location = new { latitude = DistantStations ? 0 : d.Latitude, longitude = DistantStations ? 0 : d.Longitude }
            }),
            readings = new[] { new
            {
                timestamp = (now - ReadingAge).ToString("O"),
                data = Catalog.Destinations.Select(d => new { stationId = d.Id, value })
            } }
        };
    }
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public ManualClock Clock { get; } = new();
    public WeatherFeed Feed { get; }

    public ApiFactory() => Feed = new WeatherFeed(Clock);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<TimeProvider>(Clock);
            services.AddHttpClient("weather").ConfigurePrimaryHttpMessageHandler(() => Feed);
        });
    }
}
