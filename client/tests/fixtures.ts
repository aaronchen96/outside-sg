import type { Dashboard, Destination } from "../src/types";

export const eastCoast: Destination = {
  id: "east-coast",
  name: "East Coast Park",
  region: "east",
  description: "Coastal paths and picnic spots.",
  latitude: 1.3007842,
  longitude: 103.9121866,
  mapLocation: {
    name: "East Coast Park",
    placeId: "ChIJ0QX_Brki2jER-pZKNdqk_a8",
    cid: "12681473382849091322",
  },
  activities: ["walk", "run", "cycle", "picnic"],
  tags: ["Coastal"],
  forecast: "Fair",
  forecastArea: "Marine Parade",
  score: 90,
  verdict: "Good conditions",
  reasons: ["No rain recorded nearby."],
  rainfall: null,
  temperature: null,
  humidity: null,
};

export const jurong: Destination = {
  ...eastCoast,
  id: "jurong-lake",
  name: "Jurong Lake Gardens",
  region: "west",
  description: "Lakeside paths and gardens.",
  latitude: 1.3348492,
  longitude: 103.7264557,
  mapLocation: {
    name: "Jurong Lake Gardens",
    placeId: "ChIJWQLwKP0P2jER-AOMrDbkIW8",
    cid: "8007932535915676664",
  },
};

export const dashboard: Dashboard = {
  updatedAt: "2026-11-14T02:00:00Z",
  fetchedAt: "2026-11-14T02:00:00Z",
  status: "live",
  message: null,
  forecastWindow: null,
  summary: { temperatureLow: 25, temperatureHigh: 32, humidityLow: 60, humidityHigh: 95, forecast: "Fair" },
  periods: [],
  destinations: [eastCoast, jurong],
  sources: [],
};
