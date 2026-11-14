using System.Net;
using System.Net.Http.Json;
using Outside.Api;

namespace Outside.Api.Tests;

public sealed class DashboardTests
{
    [Fact]
    public async Task HealthDoesNotDependOnWeatherFeeds()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"status\":\"ok\"", await response.Content.ReadAsStringAsync());
        Assert.Empty(app.Feed.Calls);
        Assert.Equal("no-store", response.Headers.CacheControl!.ToString());
        Assert.Contains("frame-src https://www.google.com", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Theory]
    [InlineData("activity=swim")]
    [InlineData("region=moon")]
    [InlineData("activity=Walk")]
    public async Task InvalidFiltersReturn400BeforeFetchingWeather(string query)
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/api/dashboard?" + query);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Invalid filters", await response.Content.ReadAsStringAsync());
        Assert.Empty(app.Feed.Calls);
    }

    [Fact]
    public async Task UnknownApiPathReturnsJson404()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var response = await client.GetAsync("/api/not-an-endpoint");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType!.MediaType);
    }

    [Fact]
    public async Task DefaultDashboardContainsRankedPlacesAndMapIdentities()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal("live", dashboard.Status);
        Assert.Null(dashboard.Message);
        Assert.Equal(10, dashboard.Destinations.Length);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Equal(90, d.Score);
            Assert.Equal("Good conditions", d.Verdict);
            Assert.NotNull(d.Temperature);
            Assert.Equal(0, d.Temperature.DistanceKm);
            Assert.StartsWith("ChIJ", d.MapLocation.PlaceId);
            Assert.True(ulong.TryParse(d.MapLocation.Cid, out _));
        });
        Assert.Equal(dashboard.Destinations.Select(d => d.Name).Order(), dashboard.Destinations.Select(d => d.Name));
        Assert.Equal(25, dashboard.Summary.TemperatureLow);
        Assert.Single(dashboard.Periods);
        Assert.Equal(5, dashboard.Sources.Length);
    }

    [Theory]
    [InlineData("run", "north", 2)]
    [InlineData("cycle", "central", 1)]
    [InlineData("picnic", "south", 1)]
    [InlineData("cycle", "south", 0)]
    public async Task FiltersOnlyReturnMatchingDestinations(string activity, string region, int count)
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>($"/api/dashboard?activity={activity}&region={region}"))!;
        Assert.Equal(count, dashboard.Destinations.Length);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Equal(region, d.Region);
            Assert.Contains(activity, d.Activities);
        });
    }

    [Theory]
    [InlineData("Fair", 0, 28, "walk", 90, "Good conditions")]
    [InlineData("Thundery Showers", 0, 28, "walk", 20, "Consider postponing")]
    [InlineData("Showers", 0, 28, "walk", 50, "Plan with care")]
    [InlineData("Fair", 2, 28, "picnic", 50, "Plan with care")]
    [InlineData("Fair", 0, 32, "run", 70, "Plan with care")]
    [InlineData("Fair", 0, 32, "walk", 80, "Good conditions")]
    [InlineData("Thundery Showers", 5, 35, "picnic", 0, "Consider postponing")]
    public async Task ConditionsAndActivityAffectRecommendations(string forecast, double rain, double temperature, string activity, int score, string verdict)
    {
        using var app = new ApiFactory();
        app.Feed.Forecast = forecast;
        app.Feed.Rainfall = rain;
        app.Feed.Temperature = temperature;
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>($"/api/dashboard?activity={activity}"))!;
        Assert.NotEmpty(dashboard.Destinations);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Equal(score, d.Score);
            Assert.Equal(verdict, d.Verdict);
            Assert.NotEmpty(d.Reasons);
        });
    }

    [Theory]
    [InlineData("stale readings")]
    [InlineData("expired forecast")]
    [InlineData("distant stations")]
    [InlineData("malformed feeds")]
    public async Task UnusableEssentialDataDoesNotProduceScores(string scenario)
    {
        using var app = new ApiFactory();
        app.Feed.ReadingAge = scenario == "stale readings" ? TimeSpan.FromMinutes(31) : TimeSpan.Zero;
        app.Feed.ExpiredForecast = scenario == "expired forecast";
        app.Feed.DistantStations = scenario == "distant stations";
        app.Feed.Malformed = scenario == "malformed feeds";
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal(10, dashboard.Destinations.Length);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Null(d.Score);
            Assert.Equal("Awaiting current data", d.Verdict);
        });
        if (scenario == "malformed feeds") Assert.Equal("unavailable", dashboard.Status);
    }

    [Fact]
    public async Task CompleteUpstreamOutageStillReturnsPlacesWithoutInventedWeather()
    {
        using var app = new ApiFactory();
        app.Feed.FailedPaths.UnionWith(["two-hr-forecast", "twenty-four-hr-forecast", "rainfall", "air-temperature", "relative-humidity"]);
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal("unavailable", dashboard.Status);
        Assert.NotNull(dashboard.Message);
        Assert.Equal(10, dashboard.Destinations.Length);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Null(d.Score);
            Assert.Null(d.Forecast);
            Assert.Null(d.Temperature);
            Assert.Null(d.Rainfall);
        });
    }

    [Fact]
    public async Task MissingOptionalHumidityDoesNotPreventAScore()
    {
        using var app = new ApiFactory();
        app.Feed.FailedPaths.Add("relative-humidity");
        using var client = app.CreateClient();
        var dashboard = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal("stale", dashboard.Status);
        Assert.All(dashboard.Destinations, d =>
        {
            Assert.Equal(90, d.Score);
            Assert.Null(d.Humidity);
            Assert.Contains(d.Reasons, reason => reason.Contains("Humidity data is unavailable"));
        });
    }

    [Fact]
    public async Task ConcurrentRequestsShareOneRefreshAndFailedRefreshPreservesReadings()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => client.GetFromJsonAsync<Dashboard>("/api/dashboard")));
        Assert.Equal(5, app.Feed.Calls.Count);
        Assert.All(app.Feed.Calls.Values, count => Assert.Equal(1, count));

        app.Clock.Now = app.Clock.Now.AddMinutes(4);
        await client.GetFromJsonAsync<Dashboard>("/api/dashboard");
        Assert.All(app.Feed.Calls.Values, count => Assert.Equal(1, count));

        app.Clock.Now = app.Clock.Now.AddMinutes(2);
        app.Feed.FailedPaths.Add("rainfall");
        var stale = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal("stale", stale.Status);
        Assert.Equal("stale", stale.Sources.Single(s => s.Name == "Rainfall observations").Status);
        Assert.All(stale.Destinations, d =>
        {
            Assert.Null(d.Score);
            Assert.NotNull(d.Rainfall);
            Assert.Equal(0, d.Rainfall.Value);
        });

        app.Clock.Now = app.Clock.Now.AddMinutes(6);
        app.Feed.FailedPaths.Clear();
        var recovered = (await client.GetFromJsonAsync<Dashboard>("/api/dashboard"))!;
        Assert.Equal("live", recovered.Status);
        Assert.All(recovered.Destinations, d => Assert.Equal(90, d.Score));
        Assert.All(app.Feed.Calls.Values, count => Assert.Equal(3, count));
    }
}
