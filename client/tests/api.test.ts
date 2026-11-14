import { expect, it, vi } from "vitest";
import { api } from "../src/api";

it("forwards cancellation and returns API JSON", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"status":"ok"}'));
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  await expect(api("/health", { signal: controller.signal })).resolves.toEqual({ status: "ok" });
  expect(fetch).toHaveBeenCalledWith("/api/health", { signal: controller.signal, credentials: "omit" });
});

it.each([
  ['{"detail":"Choose a supported activity.","title":"Invalid filters"}', "Choose a supported activity."],
  ['{"title":"Too many requests"}', "Too many requests"],
  ["not JSON", "Request failed (503). Please try again."],
])("shows a useful error for an unsuccessful response", async (body, message) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 503 })));
  await expect(api("/dashboard")).rejects.toThrow(message);
});
