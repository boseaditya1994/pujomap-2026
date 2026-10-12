import type { LatLng } from "@/lib/domain/geo";
import { supportsMultiStopEstimate } from "@/lib/domain/route-plan";
import type { TravelMode } from "@/lib/domain/types";

/**
 * Thin client for Google Routes API `computeRoutes`.
 *
 * Cost and policy notes:
 * - The field mask asks only for distance and duration, and driving modes use
 *   TRAFFIC_UNAWARE, which keeps requests in the cheapest Routes SKU.
 * - Results are returned to the visitor and discarded. Nothing from Google is
 *   stored or cached by this application.
 */

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration";

const ROUTES_MODE: Record<TravelMode, string> = {
  walk: "WALK",
  drive: "DRIVE",
  two_wheeler: "TWO_WHEELER",
  transit: "TRANSIT",
};

export type RouteOrigin = { kind: "point"; point: LatLng } | { kind: "address"; address: string };

export type RouteEstimate = {
  distanceMeters: number;
  durationSeconds: number;
  legs: { distanceMeters: number; durationSeconds: number }[];
};

export type RouteEstimateError = "not_configured" | "unsupported_mode" | "too_few_points" | "no_route" | "upstream";
export type RouteEstimateResult = { ok: true; estimate: RouteEstimate } | { ok: false; error: RouteEstimateError };

const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const seconds = (duration: unknown) => (typeof duration === "string" ? Number.parseFloat(duration) || 0 : 0);

export function buildComputeRoutesBody(origin: RouteOrigin | null, stops: LatLng[], mode: TravelMode) {
  const points = [...stops];
  const originWaypoint =
    origin === null
      ? waypoint(points.shift() as LatLng)
      : origin.kind === "point"
        ? waypoint(origin.point)
        : { address: origin.address };
  const destination = points.pop() as LatLng;
  return {
    origin: originWaypoint,
    destination: waypoint(destination),
    intermediates: points.map(waypoint),
    travelMode: ROUTES_MODE[mode],
    ...(mode === "drive" || mode === "two_wheeler" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
    regionCode: "IN",
    units: "METRIC",
  };
}

export async function estimateRoute(
  origin: RouteOrigin | null,
  stops: LatLng[],
  mode: TravelMode,
  options: { apiKey?: string; fetchImpl?: typeof fetch; referer?: string } = {},
): Promise<RouteEstimateResult> {
  const apiKey = options.apiKey ?? process.env.GOOGLE_ROUTES_API_KEY ?? "";
  if (!apiKey) return { ok: false, error: "not_configured" };
  if (stops.length + (origin ? 1 : 0) < 2) return { ok: false, error: "too_few_points" };
  const hasIntermediates = stops.length + (origin ? 1 : 0) > 2;
  if (hasIntermediates && !supportsMultiStopEstimate(mode)) return { ok: false, error: "unsupported_mode" };

  const doFetch = options.fetchImpl ?? fetch;
  try {
    const res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(buildComputeRoutesBody(origin, stops, mode)),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Covers quota exhaustion (429), key problems (403) and bad requests. The body may
      // name the key's project, so it is logged server-side and never sent to the browser.
      console.error("[routes] Google Routes API returned", res.status);
      return { ok: false, error: "upstream" };
    }
    const data = (await res.json()) as {
      routes?: {
        distanceMeters?: number;
        duration?: string;
        legs?: { distanceMeters?: number; duration?: string }[];
      }[];
    };
    const route = data.routes?.[0];
    if (!route || typeof route.distanceMeters !== "number") return { ok: false, error: "no_route" };
    return {
      ok: true,
      estimate: {
        distanceMeters: route.distanceMeters,
        durationSeconds: seconds(route.duration),
        legs: (route.legs ?? []).map((l) => ({
          distanceMeters: l.distanceMeters ?? 0,
          durationSeconds: seconds(l.duration),
        })),
      },
    };
  } catch (err) {
    console.error("[routes] request failed", err instanceof Error ? err.name : "unknown");
    return { ok: false, error: "upstream" };
  }
}
