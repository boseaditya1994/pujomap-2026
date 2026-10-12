import type { LatLng } from "./geo";
import type { PlanStart } from "./route-plan";
import type { TravelMode } from "./types";

const DIR_BASE = "https://www.google.com/maps/dir/";
const SEARCH_BASE = "https://www.google.com/maps/search/";

/** Documented limit for Google Maps URLs: up to 9 waypoints between origin and destination. */
export const MAX_DEEPLINK_WAYPOINTS = 9;

const GMAPS_MODE: Record<TravelMode, string> = {
  walk: "walking",
  drive: "driving",
  two_wheeler: "two-wheeler",
  transit: "transit",
};

const coord = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Opens the pin in Google Maps. */
export function placeUrl(p: LatLng): string {
  const sp = new URLSearchParams({ api: "1", query: coord(p) });
  return `${SEARCH_BASE}?${sp}`;
}

/** Turn-by-turn directions to one pandal from wherever the user is. */
export function navigateUrl(p: LatLng, mode: TravelMode = "walk"): string {
  const sp = new URLSearchParams({ api: "1", destination: coord(p), travelmode: GMAPS_MODE[mode] });
  return `${DIR_BASE}?${sp}`;
}

export type DirectionsLink = { fromIndex: number; toIndex: number; url: string };

/**
 * Builds Google Maps links for a multi-stop plan.
 *
 * - With "auto" start the origin is omitted, so Google Maps uses the device's
 *   location itself and no position is embedded in the link.
 * - Transit directions do not support waypoints, so transit plans become one
 *   link per leg.
 * - Longer plans are split into consecutive links of at most 9 waypoints.
 *
 * Indices refer to `stops`; fromIndex -1 means "from the start location".
 */
export function buildDirectionsLinks(stops: LatLng[], mode: TravelMode, start: PlanStart): DirectionsLink[] {
  if (stops.length === 0) return [];
  const originOf = (s: PlanStart): string | null => (s.kind === "place" ? s.query : s.kind === "geo" ? coord(s) : null);

  const link = (origin: string | null, pts: LatLng[]): string => {
    const sp = new URLSearchParams({ api: "1" });
    if (origin) sp.set("origin", origin);
    sp.set("destination", coord(pts[pts.length - 1]));
    if (pts.length > 1) sp.set("waypoints", pts.slice(0, -1).map(coord).join("|"));
    sp.set("travelmode", GMAPS_MODE[mode]);
    return `${DIR_BASE}?${sp}`;
  };

  const links: DirectionsLink[] = [];
  const chunk = mode === "transit" ? 1 : MAX_DEEPLINK_WAYPOINTS + 1;
  let origin = originOf(start);
  let fromIndex = -1;
  for (let i = 0; i < stops.length; i += chunk) {
    const pts = stops.slice(i, i + chunk);
    links.push({ fromIndex, toIndex: i + pts.length - 1, url: link(origin, pts) });
    fromIndex = i + pts.length - 1;
    origin = coord(stops[fromIndex]);
  }
  return links;
}
