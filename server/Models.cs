namespace Outside.Api;

public sealed record MapLocation(string Name, string PlaceId, string Cid);

public sealed record Destination(string Id, string Name, string Region, string Description, double Latitude, double Longitude, string[] Activities, string[] Tags, MapLocation MapLocation);
public sealed record Observation(double Value, string Unit, string Station, double DistanceKm, string Timestamp);
public sealed record ForecastWindow(string Start, string End);
public sealed record Period(string Start, string End, string Forecast);
public sealed record Summary(double? TemperatureLow, double? TemperatureHigh, double? HumidityLow, double? HumidityHigh, string? Forecast);
public sealed record Source(string Name, string Url, string Status, string? UpdatedAt);
public sealed record DestinationWeather(string Id, string Name, string Region, string Description, double Latitude, double Longitude, string[] Activities, string[] Tags,
    string? Forecast, string? ForecastArea, int? Score, string Verdict, string[] Reasons, Observation? Rainfall, Observation? Temperature, Observation? Humidity, MapLocation MapLocation);
public sealed record Dashboard(string? UpdatedAt, string FetchedAt, string Status, string? Message, ForecastWindow? ForecastWindow,
    Summary Summary, Period[] Periods, DestinationWeather[] Destinations, Source[] Sources);

public static class Catalog
{
    public static readonly string[] Activities = ["walk", "run", "cycle", "picnic"];
    public static readonly string[] Regions = ["all", "central", "east", "west", "north", "south"];
    // Google Maps place listings checked on 2026-11-14; Pasir Ris uses Area 2.
    public static readonly Destination[] Destinations = [
        new("east-coast", "East Coast Park", "east", "A coastal escape with long paths and breezy picnic spots.", 1.3007842, 103.9121866, ["walk", "run", "cycle", "picnic"], ["Coastal", "Open paths"], new("East Coast Park", "ChIJ0QX_Brki2jER-pZKNdqk_a8", "12681473382849091322")),
        new("marina-barrage", "Marina Barrage", "south", "Waterfront walks and a wide lawn beside the city skyline.", 1.2805168, 103.8714399, ["walk", "run", "picnic"], ["Waterfront", "Open lawn"], new("Marina Barrage", "ChIJ50uIMa0Z2jER0cTt5fLaZt0", "15953679466781066449")),
        new("botanic-gardens", "Singapore Botanic Gardens", "central", "Leafy garden paths, quiet lawns and a slower pace.", 1.3138397, 103.8159136, ["walk", "run", "picnic"], ["Gardens", "Shaded paths"], new("Singapore Botanic Gardens", "ChIJvWDbfRwa2jERgNnTOpAU3-o", "16924268534376421760")),
        new("bishan-park", "Bishan–Ang Mo Kio Park", "central", "Riverside paths and generous green spaces in the heartlands.", 1.3634088, 103.8435614, ["walk", "run", "cycle", "picnic"], ["Riverside", "Open lawn"], new("Bishan-Ang Mo Kio Park", "ChIJjyjjwCAX2jERxYHvTxAw4X0", "9070583971119595973")),
        new("macritchie", "MacRitchie Reservoir", "central", "Reservoir-side paths and forest trails for a nature break.", 1.3418609, 103.8346383, ["walk", "run"], ["Reservoir", "Nature trails"], new("MacRitchie Reservoir Park", "ChIJe5hVz0sX2jER-c8FdCp_ZkQ", "4928766662515478521")),
        new("jurong-lake", "Jurong Lake Gardens", "west", "Lakeside greenery, winding paths and space to unwind.", 1.3348492, 103.7264557, ["walk", "run", "cycle", "picnic"], ["Lakeside", "Gardens"], new("Jurong Lake Gardens", "ChIJWQLwKP0P2jER-AOMrDbkIW8", "8007932535915676664")),
        new("pasir-ris", "Pasir Ris Park", "east", "A relaxed shoreline with coastal paths and picnic areas.", 1.3767681, 103.9515504, ["walk", "run", "cycle", "picnic"], ["Coastal", "Picnic spots"], new("Pasir Ris Park Area 2", "ChIJ7cCa2Lc92jERH_ROYWinEfE", "17370849304495715359")),
        new("southern-ridges", "Southern Ridges", "south", "Elevated greenery and hilly walking routes above the city.", 1.2790199, 103.8094952, ["walk", "run"], ["Hills", "Nature trails"], new("Southern Ridges", "ChIJO1VVxd8b2jERTvL6uurcNWY", "7365035666351780430")),
        new("woodlands-waterfront", "Woodlands Waterfront", "north", "An easy waterfront outing overlooking the Johor Strait.", 1.4530529, 103.7804801, ["walk", "run", "cycle", "picnic"], ["Waterfront", "Open paths"], new("Woodlands Waterfront Park", "ChIJi090zPwS2jERiJCqFWoP8Z4", "11452952275684331656")),
        new("punggol-waterway", "Punggol Waterway Park", "north", "Follow the waterway through open spaces and neighbourhood greenery.", 1.4111377, 103.9044621, ["walk", "run", "cycle", "picnic"], ["Waterway", "Open paths"], new("Punggol Waterway Park", "ChIJBVVBo_EV2jER-jKR3Hy6qUk", "5307978681272054522"))
    ];
}
