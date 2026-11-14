import type { Activity, Destination, Plan } from "./types";

const storageKey = "outside-sg.plans.v1";
const supportedActivities: Activity[] = ["walk", "run", "cycle", "picnic"];
const destinationIds = new Set([
  "east-coast",
  "marina-barrage",
  "botanic-gardens",
  "bishan-park",
  "macritchie",
  "jurong-lake",
  "pasir-ris",
  "southern-ridges",
  "woodlands-waterfront",
  "punggol-waterway",
]);

export function singaporeDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.id === "string" &&
    plan.id.length > 0 &&
    plan.id.length <= 100 &&
    typeof plan.destinationId === "string" &&
    destinationIds.has(plan.destinationId) &&
    typeof plan.destinationName === "string" &&
    plan.destinationName.length > 0 &&
    plan.destinationName.length <= 120 &&
    supportedActivities.includes(plan.activity as Activity) &&
    validDate(plan.date) &&
    typeof plan.notes === "string" &&
    plan.notes.length <= 500 &&
    typeof plan.createdAt === "string" &&
    Number.isFinite(Date.parse(plan.createdAt))
  );
}

export function readLocalPlans(): Plan[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    throw new Error(
      "This browser is blocking saved plans. Allow local storage to save a plan, or keep exploring without saving.",
    );
  }
  if (raw === null) return [];
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") throw new Error();
    const { version, plans } = saved as { version?: unknown; plans?: unknown };
    if (
      version !== 1 ||
      !Array.isArray(plans) ||
      plans.length > 100 ||
      !plans.every(validPlan) ||
      new Set(plans.map((plan: Plan) => plan.id)).size !== plans.length
    )
      throw new Error();
    return plans;
  } catch {
    throw new Error(
      "Saved plans in this browser could not be read. Reset saved plans in My plans to start again. Existing storage has not been overwritten.",
    );
  }
}

function writeLocalPlans(plans: Plan[]): Plan[] {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, plans }),
    );
  } catch {
    throw new Error(
      "The browser could not save this change. Storage may be blocked or full. Your existing plans have not been changed.",
    );
  }
  return plans;
}

export function addLocalPlan(
  destination: Destination,
  activity: Activity,
  date: string,
  notes: string,
): Plan[] {
  if (
    !destinationIds.has(destination.id) ||
    !destination.activities.includes(activity)
  )
    throw new Error("Choose an available destination and activity.");
  if (!validDate(date) || date < singaporeDate() || date > singaporeDate(365))
    throw new Error(
      "Choose a date from today through the next 365 days, in Singapore time.",
    );
  if (notes.length > 500)
    throw new Error("Keep notes to 500 characters or fewer.");
  const plans = readLocalPlans();
  if (plans.length >= 100)
    throw new Error(
      "You have reached 100 saved plans. Remove a plan in My plans before adding another.",
    );
  const plan: Plan = {
    id: crypto.randomUUID(),
    destinationId: destination.id,
    destinationName: destination.name,
    activity,
    date,
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
  };
  return writeLocalPlans([...plans, plan]);
}

export function removeLocalPlan(id: string): Plan[] {
  return writeLocalPlans(readLocalPlans().filter((plan) => plan.id !== id));
}

export function resetLocalPlans(): Plan[] {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    throw new Error(
      "This browser is blocking saved plans. Allow local storage before trying again.",
    );
  }
  return [];
}
