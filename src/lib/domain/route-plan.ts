import { haversineMeters, type LatLng } from "./geo";
import { TRAVEL_MODES, type TravelMode } from "./types";

/**
 * Google Maps directions links accept at most 9 waypoints plus a destination,
 * so a plan holds at most 10 stops. That also keeps Routes API requests at or
 * below 9 intermediates, inside the cheaper (<= 10 intermediates) billing tier.
 */
export const MAX_STOPS = 10;

export type PlanStart =
  | { kind: "auto" } // let Google Maps use the device's current location
  | { kind: "place"; query: string } // a place name resolved by Google
  | { kind: "geo"; lat: number; lng: number }; // device location, held in memory only

export type RoutePlan = {
  stops: string[]; // pandal slugs, in visiting order
  mode: TravelMode;
  start: PlanStart;
};

export const EMPTY_PLAN: RoutePlan = { stops: [], mode: "walk", start: { kind: "auto" } };

export type PlanChange = { ok: true; plan: RoutePlan } | { ok: false; reason: "limit" | "duplicate" };

export function addStop(plan: RoutePlan, slug: string): PlanChange {
  if (plan.stops.includes(slug)) return { ok: false, reason: "duplicate" };
  if (plan.stops.length >= MAX_STOPS) return { ok: false, reason: "limit" };
  return { ok: true, plan: { ...plan, stops: [...plan.stops, slug] } };
}

export function removeStop(plan: RoutePlan, slug: string): RoutePlan {
  return { ...plan, stops: plan.stops.filter((s) => s !== slug) };
}

export function moveStop(plan: RoutePlan, index: number, delta: -1 | 1): RoutePlan {
  const target = index + delta;
  if (index < 0 || index >= plan.stops.length || target < 0 || target >= plan.stops.length) return plan;
  const stops = [...plan.stops];
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return { ...plan, stops };
}

/**
 * Serialises a plan for a shareable URL. A device location ("geo") is never
 * written to the URL; it degrades to "auto".
 */
export function planToParams(plan: RoutePlan): URLSearchParams {
  const sp = new URLSearchParams();
  if (plan.stops.length) sp.set("stops", plan.stops.join(","));
  if (plan.mode !== "walk") sp.set("mode", plan.mode);
  if (plan.start.kind === "place" && plan.start.query.trim()) sp.set("from", plan.start.query.trim());
  return sp;
}

export function planFromParams(sp: URLSearchParams): RoutePlan {
  const seen = new Set<string>();
  const stops = (sp.get("stops") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s) && !seen.has(s) && seen.add(s))
    .slice(0, MAX_STOPS);
  const modeParam = sp.get("mode");
  const mode = (TRAVEL_MODES as readonly string[]).includes(modeParam ?? "") ? (modeParam as TravelMode) : "walk";
  const from = (sp.get("from") ?? "").trim().slice(0, 200);
  return { stops, mode, start: from ? { kind: "place", query: from } : { kind: "auto" } };
}

/** Sum of straight-line hops. Not a route estimate; shown only with that label. */
export function straightLineTotalMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/**
 * Greedy nearest-neighbour ordering on straight-line distance. Offered as an
 * alternative order to compare against, never presented as optimal.
 */
export function nearestFirstOrder<T extends LatLng>(stops: T[], origin?: LatLng): T[] {
  if (stops.length < 2) return [...stops];
  const remaining = [...stops];
  const ordered: T[] = [];
  let current: LatLng = origin ?? remaining[0];
  if (!origin) ordered.push(remaining.shift() as T);
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineMeters(current, s);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

/** Routes API only accepts intermediate stops for non-transit modes. */
export function supportsMultiStopEstimate(mode: TravelMode): boolean {
  return mode !== "transit";
}
