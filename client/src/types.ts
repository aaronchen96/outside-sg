export type Activity = "walk" | "run" | "cycle" | "picnic";
export type Reading = {
  value: number;
  unit: string;
  station: string;
  distanceKm: number;
  timestamp: string;
};
export type Destination = {
  id: string;
  name: string;
  region: string;
  description: string;
  latitude: number;
  longitude: number;
  mapLocation: { name: string; placeId: string; cid: string };
  activities: string[];
  tags: string[];
  forecast: string | null;
  forecastArea: string | null;
  score: number | null;
  verdict: string;
  reasons: string[];
  rainfall: Reading | null;
  temperature: Reading | null;
  humidity: Reading | null;
};
export type Dashboard = {
  updatedAt: string | null;
  fetchedAt: string;
  status: "live" | "stale" | "unavailable";
  message: string | null;
  forecastWindow: { start: string; end: string } | null;
  summary: {
    temperatureLow: number | null;
    temperatureHigh: number | null;
    humidityLow: number | null;
    humidityHigh: number | null;
    forecast: string | null;
  };
  periods: { start: string; end: string; forecast: string }[];
  destinations: Destination[];
  sources: {
    name: string;
    url: string;
    status: string;
    updatedAt: string | null;
  }[];
};
export type Plan = {
  id: string;
  destinationId: string;
  destinationName: string;
  activity: Activity;
  date: string;
  notes: string;
  createdAt: string;
};
