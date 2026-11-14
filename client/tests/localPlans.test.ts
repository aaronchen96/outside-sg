import { beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalPlan, readLocalPlans, removeLocalPlan, resetLocalPlans, singaporeDate } from "../src/localPlans";
import { eastCoast } from "./fixtures";

const key = "outside-sg.plans.v1";

beforeEach(() => {
  vi.useFakeTimers();
  // It is already 14 November in Singapore, while UTC is still 13 November.
  vi.setSystemTime(new Date("2026-11-13T17:00:00Z"));
  localStorage.clear();
});

describe("saved plans", () => {
  it("uses the Singapore calendar across UTC midnight and year boundaries", () => {
    expect(singaporeDate()).toBe("2026-11-14");
    expect(singaporeDate(1)).toBe("2026-11-15");
    vi.setSystemTime(new Date("2026-12-31T17:00:00Z"));
    expect(singaporeDate()).toBe("2027-01-01");
  });

  it("adds, reloads, and removes a plan without removing other plans", () => {
    expect(readLocalPlans()).toEqual([]);
    const [first] = addLocalPlan(eastCoast, "walk", singaporeDate(), "  Bring water  ");
    expect(first.notes).toBe("Bring water");
    const plans = addLocalPlan(eastCoast, "run", singaporeDate(365), "");
    expect(plans).toHaveLength(2);
    expect(new Set(plans.map(p => p.id)).size).toBe(2);
    expect(readLocalPlans()).toEqual(plans);
    expect(removeLocalPlan(first.id)).toEqual([plans[1]]);
  });

  it.each(["2026-11-13", "2027-11-15", "2027-02-30", "not-a-date"])("rejects invalid or out-of-range date %s", date => {
    expect(() => addLocalPlan(eastCoast, "walk", date, "")).toThrow("Choose a date");
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("rejects unsupported places, activities, oversized notes and a 101st plan", () => {
    expect(() => addLocalPlan({ ...eastCoast, id: "unknown" }, "walk", singaporeDate(), "")).toThrow("Choose an available");
    expect(() => addLocalPlan({ ...eastCoast, activities: ["walk"] }, "cycle", singaporeDate(), "")).toThrow("Choose an available");
    expect(() => addLocalPlan(eastCoast, "walk", singaporeDate(), "x".repeat(501))).toThrow("500 characters");
    for (let i = 0; i < 100; i++) addLocalPlan(eastCoast, "walk", singaporeDate(), "");
    const before = localStorage.getItem(key);
    expect(() => addLocalPlan(eastCoast, "walk", singaporeDate(), "")).toThrow("100 saved plans");
    expect(localStorage.getItem(key)).toBe(before);
  });

  it.each(["{broken", '{"version":2,"plans":[]}', '{"version":1,"plans":[{}]}'])("preserves unreadable storage until explicitly reset", raw => {
    localStorage.setItem(key, raw);
    expect(() => readLocalPlans()).toThrow("could not be read");
    expect(() => addLocalPlan(eastCoast, "walk", singaporeDate(), "")).toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
    expect(resetLocalPlans()).toEqual([]);
    expect(readLocalPlans()).toEqual([]);
  });

  it("rejects duplicate stored IDs", () => {
    const [plan] = addLocalPlan(eastCoast, "walk", singaporeDate(), "");
    localStorage.setItem(key, JSON.stringify({ version: 1, plans: [plan, plan] }));
    expect(() => readLocalPlans()).toThrow("could not be read");
  });

  it("reports blocked storage reads", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(() => readLocalPlans()).toThrow("blocking saved plans");
  });

  it("preserves existing plans when a write fails", () => {
    addLocalPlan(eastCoast, "walk", singaporeDate(), "Keep this");
    const before = localStorage.getItem(key);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => addLocalPlan(eastCoast, "walk", singaporeDate(), "New")).toThrow("could not save");
    expect(localStorage.getItem(key)).toBe(before);
  });
});
