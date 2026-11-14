using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Outside.Api;

var builder = WebApplication.CreateBuilder(args);
if (string.IsNullOrEmpty(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://localhost:5100");

builder.Services.AddSingleton<WeatherService>();
builder.Services.AddHttpClient("weather", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Weather:BaseUrl"] ?? "https://api-open.data.gov.sg/v2/real-time/api/");
    client.Timeout = TimeSpan.FromSeconds(12);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("OutsideSG/1.0 (local-public-data-project)");
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            title = "Too many requests",
            detail = "Please wait a minute before trying again.",
            status = 429
        }, token);
    };
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
        RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 180,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16 * 1024);

var app = builder.Build();
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var status = exception is BadHttpRequestException ? 400 : 500;
    context.Response.StatusCode = status;
    await context.Response.WriteAsJsonAsync(new
    {
        title = status == 400 ? "Invalid request" : "Something went wrong",
        detail = status == 400 ? "Check the request format and try again." : "The request could not be completed. Try again shortly.",
        status
    });
}));
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseRateLimiter();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", service = "Outside SG API" }));
app.MapGet("/api/dashboard", async (string? activity, string? region, WeatherService weather, CancellationToken ct) =>
{
    activity ??= "walk";
    region ??= "all";
    if (!Catalog.Activities.Contains(activity) || !Catalog.Regions.Contains(region))
        return Error(400, "Invalid filters", "Choose a supported activity and region.");
    return Results.Ok(await weather.GetDashboard(activity, region, ct));
});
// This demo has a read-only API. Plans belong to the browser's local storage.
app.MapFallback("/api/{**path}", () => Error(404, "Endpoint not found", "Check the API path and method."));

var clientDist = Path.GetFullPath("../client/dist", app.Environment.ContentRootPath);
if (Directory.Exists(clientDist))
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(clientDist) });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(clientDist) });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = new PhysicalFileProvider(clientDist) });
}
else
{
    app.MapGet("/", () => Results.Text("Outside SG API is running. Build the client or start Vite at http://localhost:5173."));
}
app.Run();

static IResult Error(int status, string title, string detail) => Results.Json(new { title, detail, status }, statusCode: status);
