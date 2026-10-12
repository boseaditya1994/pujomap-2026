import { FESTIVAL_YEAR, REGIONS, type Pandal, type RegionId } from "./types";
import { haversineMeters, type LatLng } from "./geo";

export type ThemeDisplay =
  | { kind: "confirmed"; title: string; year: number; source: string }
  | { kind: "unconfirmed"; title: string; year: number }
  | { kind: "historical"; title: string; year: number }
  | { kind: "unknown" };

/**
 * Decides how a theme may be presented. A theme from any year other than the
 * festival year is always historical, whatever its stored status says.
 */
export function getThemeDisplay(
  p: Pick<Pandal, "themeTitle" | "themeYear" | "themeStatus" | "themeSource">,
  festivalYear: number = FESTIVAL_YEAR,
): ThemeDisplay {
  if (!p.themeTitle || !p.themeYear) return { kind: "unknown" };
  if (p.themeYear !== festivalYear) return { kind: "historical", title: p.themeTitle, year: p.themeYear };
  if (p.themeStatus === "confirmed" && p.themeSource) {
    return { kind: "confirmed", title: p.themeTitle, year: p.themeYear, source: p.themeSource };
  }
  return { kind: "unconfirmed", title: p.themeTitle, year: p.themeYear };
}

export function isVerified(p: Pick<Pandal, "verificationStatus">): boolean {
  return p.verificationStatus === "verified";
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export type PandalFilters = {
  q: string;
  region: RegionId | null;
  neighbourhood: string | null;
  verifiedOnly: boolean;
  near: LatLng | null;
  radiusM: number | null;
};

export const EMPTY_FILTERS: PandalFilters = {
  q: "",
  region: null,
  neighbourhood: null,
  verifiedOnly: false,
  near: null,
  radiusM: null,
};

const normalise = (s: string) => s.normalize("NFKC").toLowerCase().trim();

function searchableText(p: Pandal): string {
  return normalise(
    [p.name, p.nameBn, p.address, p.neighbourhood, p.committee, p.nearestMetro, p.themeTitle].filter(Boolean).join(" "),
  );
}

/** Every whitespace-separated term must appear somewhere in the pandal's searchable text. */
export function matchesQuery(p: Pandal, q: string): boolean {
  const terms = normalise(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = searchableText(p);
  return terms.every((t) => text.includes(t));
}

export type PandalWithDistance = Pandal & { distanceM?: number };

export function filterPandals(pandals: Pandal[], f: PandalFilters): PandalWithDistance[] {
  let out: PandalWithDistance[] = pandals.filter(
    (p) =>
      (!f.region || p.region === f.region) &&
      (!f.neighbourhood || normalise(p.neighbourhood) === normalise(f.neighbourhood)) &&
      (!f.verifiedOnly || isVerified(p)) &&
      matchesQuery(p, f.q),
  );
  if (f.near) {
    const near = f.near;
    out = out
      .map((p) => ({ ...p, distanceM: haversineMeters(near, p) }))
      .filter((p) => f.radiusM == null || p.distanceM <= f.radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
  } else {
    out = [...out].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

export function neighbourhoodsOf(pandals: Pandal[], region: RegionId | null): string[] {
  const set = new Set<string>();
  for (const p of pandals) if (!region || p.region === region) set.add(p.neighbourhood);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function nearbyPandals(pandals: Pandal[], origin: Pandal, limit = 4, maxMeters = 3000) {
  return pandals
    .filter((p) => p.id !== origin.id)
    .map((p) => ({ ...p, distanceM: haversineMeters(origin, p) }))
    .filter((p) => p.distanceM <= maxMeters)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function parseRegion(v: string | null | undefined): RegionId | null {
  return (REGIONS as readonly string[]).includes(v ?? "") ? (v as RegionId) : null;
}

/** Filters that are safe to put in a shareable URL. The user's position is deliberately excluded. */
export function filtersToParams(f: PandalFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.region) sp.set("region", f.region);
  if (f.neighbourhood) sp.set("area", f.neighbourhood);
  if (f.verifiedOnly) sp.set("verified", "1");
  return sp;
}

export function filtersFromParams(sp: URLSearchParams): PandalFilters {
  return {
    ...EMPTY_FILTERS,
    q: sp.get("q") ?? "",
    region: parseRegion(sp.get("region")),
    neighbourhood: sp.get("area") || null,
    verifiedOnly: sp.get("verified") === "1",
  };
}
