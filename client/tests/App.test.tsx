import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import App from "../src/App";
import { api } from "../src/api";
import { dashboard, eastCoast, jurong } from "./fixtures";

vi.mock("../src/api", () => ({ api: vi.fn() }));

beforeEach(() => {
  vi.mocked(api).mockResolvedValue(dashboard);
});

it("searches destinations and requests new activity and region filters", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "East Coast Park" });
  await user.type(screen.getByRole("textbox", { name: "Search destinations" }), "Jurong");
  expect(screen.queryByRole("button", { name: "East Coast Park" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Jurong Lake Gardens" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "A bike ride" }));
  expect(api).toHaveBeenLastCalledWith("/dashboard?activity=cycle&region=all", expect.anything());
  await user.selectOptions(screen.getByRole("combobox", { name: "Filter by region" }), "west");
  expect(api).toHaveBeenLastCalledWith("/dashboard?activity=cycle&region=west", expect.anything());
});

it("saves a plan, restores it after remounting, and removes it", async () => {
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(await screen.findByRole("button", { name: "Save a plan for East Coast Park" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByRole("textbox"), "Bring water");
  await user.click(within(dialog).getByRole("button", { name: "Save my plan" }));
  first.unmount();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "My plans" }));
  expect(await screen.findByText("Bring water")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.queryByText("Bring water")).not.toBeInTheDocument();
  expect(screen.getByText("No saved plans yet. Find a place and make it a date.")).toBeInTheDocument();
});

it("keeps the selected map, directions and detail link on the same named place", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "East Coast Park" });
  await user.click(screen.getByRole("button", { name: "Map view" }));
  expect(screen.getByTitle("Google Maps location of East Coast Park")).toHaveAttribute("src", expect.stringContaining(`cid=${eastCoast.mapLocation.cid}`));
  const chooser = screen.getByRole("group", { name: "Choose a place on the map" });
  await user.click(within(chooser).getByRole("button", { name: "Jurong Lake Gardens" }));
  expect(screen.getByTitle("Google Maps location of Jurong Lake Gardens")).toHaveAttribute("src", expect.stringContaining(`cid=${jurong.mapLocation.cid}`));
  expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", expect.stringContaining(`destination_place_id=${jurong.mapLocation.placeId}`));
  await user.click(screen.getByRole("button", { name: "View place" }));
  expect(screen.getByRole("link", { name: "Open in Maps" })).toHaveAttribute("href", expect.stringContaining(`query_place_id=${jurong.mapLocation.placeId}`));
});

it("recovers from an API error when the user retries", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("Weather request failed."));
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Weather request failed.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: "East Coast Park" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
