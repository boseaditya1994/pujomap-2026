import { describe, expect, it } from "vitest";
import { buildDemoPandals } from "@/lib/data/demo-data";
import { buildDirectionsLinks, navigateUrl, placeUrl } from "@/lib/domain/deeplinks";
import { boundsOf, haversineMeters } from "@/lib/domain/geo";
import {
  EMPTY_FILTERS,
  filterPandals,
  filtersFromParams,
  filtersToParams,
  getThemeDisplay,
  nearbyPandals,
  neighbourhoodsOf,
  slugify,
} from "@/lib/domain/pandal";
import {
  EMPTY_PLAN,
  MAX_STOPS,
  addStop,
  moveStop,
  nearestFirstOrder,
  planFromParams,
  planToParams,
  removeStop,
  straightLineTotalMeters,
  supportsMultiStopEstimate,
} from "@/lib/domain/route-plan";
import { FESTIVAL_YEAR, pandalInputSchema, submissionInputSchema } from "@/lib/domain/types";

const pandals = buildDemoPandals();

describe("geo", () => {
  it("measures a known distance (1 degree of latitude is about 111.2 km)", () => {
    const d = haversineMeters({ lat: 22, lng: 88 }, { lat: 23, lng: 88 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
  it("is zero for identical points and symmetric", () => {
    const a = { lat: 22.57, lng: 88.36 };
    const b = { lat: 22.6, lng: 88.4 };
    expect(haversineMeters(a, a)).toBe(0);
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
  it("computes bounds, and null for no points", () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { lat: 1, lng: 5 },
        { lat: 3, lng: 2 },
      ]),
    ).toEqual({ south: 1, north: 3, west: 2, east: 5 });
  });
});

describe("theme display", () => {
  const base = { themeTitle: "T", themeYear: FESTIVAL_YEAR, themeStatus: "confirmed" as const, themeSource: "src" };
  it("shows a sourced current-year theme as confirmed", () => {
    expect(getThemeDisplay(base).kind).toBe("confirmed");
  });
  it("never shows an earlier year's theme as confirmed, whatever the stored status", () => {
    expect(getThemeDisplay({ ...base, themeYear: FESTIVAL_YEAR - 1 })).toEqual({
      kind: "historical",
      title: "T",
      year: FESTIVAL_YEAR - 1,
    });
  });
  it("downgrades a confirmed theme without a source", () => {
    expect(getThemeDisplay({ ...base, themeSource: null }).kind).toBe("unconfirmed");
  });
  it("is unknown without a title or year", () => {
    expect(getThemeDisplay({ ...base, themeTitle: null }).kind).toBe("unknown");
    expect(getThemeDisplay({ ...base, themeYear: null }).kind).toBe("unknown");
  });
});

describe("pandal schema", () => {
  const valid = {
    name: "Test Pandal",
    slug: "test-pandal",
    address: "1 Test Road",
    lat: 22.57,
    lng: 88.36,
    neighbourhood: "Test",
    region: "central",
  };
  it("accepts a minimal record with safe defaults", () => {
    const p = pandalInputSchema.parse(valid);
    expect(p.themeStatus).toBe("unknown");
    expect(p.verificationStatus).toBe("unverified");
    expect(p.images).toEqual([]);
  });
  it("rejects coordinates outside Greater Kolkata", () => {
    expect(pandalInputSchema.safeParse({ ...valid, lat: 28.61, lng: 77.2 }).success).toBe(false);
  });
  it("rejects a confirmed theme from an earlier year", () => {
    const r = pandalInputSchema.safeParse({
      ...valid,
      themeStatus: "confirmed",
      themeTitle: "Old",
      themeSource: "https://example.org",
      themeYear: FESTIVAL_YEAR - 1,
    });
    expect(r.success).toBe(false);
  });
  it("rejects a confirmed theme without a source", () => {
    const r = pandalInputSchema.safeParse({
      ...valid,
      themeStatus: "confirmed",
      themeTitle: "X",
      themeYear: FESTIVAL_YEAR,
    });
    expect(r.success).toBe(false);
  });
  it("rejects 'verified' without a source and date", () => {
    expect(pandalInputSchema.safeParse({ ...valid, verificationStatus: "verified" }).success).toBe(false);
    expect(
      pandalInputSchema.safeParse({
        ...valid,
        verificationStatus: "verified",
        verificationSource: "Site visit",
        lastVerifiedAt: "2026-10-01",
      }).success,
    ).toBe(true);
  });
});

describe("filters", () => {
  it("returns everything, sorted by name, with no filters", () => {
    const out = filterPandals(pandals, EMPTY_FILTERS);
    expect(out).toHaveLength(pandals.length);
    expect(out.map((p) => p.name)).toEqual([...out.map((p) => p.name)].sort((a, b) => a.localeCompare(b)));
  });
  it("filters by region, neighbourhood and verification", () => {
    expect(filterPandals(pandals, { ...EMPTY_FILTERS, region: "behala" })).toHaveLength(3);
    expect(filterPandals(pandals, { ...EMPTY_FILTERS, neighbourhood: "bagbazar" })).toHaveLength(1);
    const verified = filterPandals(pandals, { ...EMPTY_FILTERS, verifiedOnly: true });
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((p) => p.verificationStatus === "verified")).toBe(true);
  });
  it("matches every search term, case-insensitively, across fields", () => {
    expect(filterPandals(pandals, { ...EMPTY_FILTERS, q: "SALT lake 2" }).map((p) => p.slug)).toEqual([
      "demo-salt-lake-2",
    ]);
    expect(filterPandals(pandals, { ...EMPTY_FILTERS, q: "gariahat" })).toHaveLength(1);
    expect(filterPandals(pandals, { ...EMPTY_FILTERS, q: "zzzz" })).toHaveLength(0);
  });
  it("sorts by distance and applies a radius when a position is given", () => {
    const near = { lat: pandals[0].lat, lng: pandals[0].lng };
    const out = filterPandals(pandals, { ...EMPTY_FILTERS, near, radiusM: 2000 });
    expect(out[0].id).toBe(pandals[0].id);
    expect(out.every((p) => (p.distanceM ?? Infinity) <= 2000)).toBe(true);
    expect(out.length).toBeLessThan(pandals.length);
  });
  it("round-trips shareable filters through the URL without the user's position", () => {
    const f = {
      ...EMPTY_FILTERS,
      q: "lake",
      region: "salt-lake" as const,
      verifiedOnly: true,
      near: { lat: 22.5, lng: 88.3 },
    };
    const sp = filtersToParams(f);
    expect(sp.toString()).not.toContain("22.5");
    expect(filtersFromParams(sp)).toEqual({ ...f, near: null });
    expect(filtersFromParams(new URLSearchParams("region=mars")).region).toBeNull();
  });
  it("lists neighbourhoods per region and finds nearby pandals", () => {
    expect(neighbourhoodsOf(pandals, "north")).toEqual(["Bagbazar", "Hatibagan", "Shyambazar"]);
    const near = nearbyPandals(pandals, pandals[0]);
    expect(near.every((p) => p.id !== pandals[0].id && p.distanceM <= 3000)).toBe(true);
  });
  it("slugifies names", () => {
    expect(slugify("  Bagbazar Sarbojanin (North)  ")).toBe("bagbazar-sarbojanin-north");
  });
});

describe("route plan", () => {
  it("adds, rejects duplicates and enforces the stop limit", () => {
    let plan = EMPTY_PLAN;
    for (let i = 0; i < MAX_STOPS; i++) {
      const r = addStop(plan, `s-${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) plan = r.plan;
    }
    expect(addStop(plan, "s-0")).toEqual({ ok: false, reason: "duplicate" });
    expect(addStop(plan, "one-more")).toEqual({ ok: false, reason: "limit" });
  });
  it("removes and reorders stops, ignoring out-of-range moves", () => {
    const plan = { ...EMPTY_PLAN, stops: ["a", "b", "c"] };
    expect(removeStop(plan, "b").stops).toEqual(["a", "c"]);
    expect(moveStop(plan, 0, 1).stops).toEqual(["b", "a", "c"]);
    expect(moveStop(plan, 2, -1).stops).toEqual(["a", "c", "b"]);
    expect(moveStop(plan, 0, -1)).toBe(plan);
    expect(moveStop(plan, 2, 1)).toBe(plan);
  });
  it("round-trips through URL params and never writes a device location", () => {
    const plan = {
      stops: ["a", "b"],
      mode: "drive" as const,
      start: { kind: "place" as const, query: "Sealdah Station" },
    };
    expect(planFromParams(planToParams(plan))).toEqual(plan);
    const geo = planToParams({ ...plan, start: { kind: "geo", lat: 22.51234, lng: 88.31234 } });
    expect(geo.toString()).not.toContain("22.5");
    expect(planFromParams(geo).start).toEqual({ kind: "auto" });
  });
  it("sanitises hostile or oversized URL input", () => {
    const many = Array.from({ length: 30 }, (_, i) => `s-${i}`).join(",");
    const plan = planFromParams(new URLSearchParams(`stops=${many},s-1,BAD SLUG,<script>&mode=teleport`));
    expect(plan.stops).toHaveLength(MAX_STOPS);
    expect(plan.mode).toBe("walk");
  });
  it("orders nearest-first without losing stops", () => {
    const pts = [
      { id: "far", lat: 22.9, lng: 88.4 },
      { id: "near", lat: 22.51, lng: 88.4 },
      { id: "mid", lat: 22.7, lng: 88.4 },
    ];
    expect(nearestFirstOrder(pts, { lat: 22.5, lng: 88.4 }).map((p) => p.id)).toEqual(["near", "mid", "far"]);
    expect(nearestFirstOrder(pts).map((p) => p.id)).toEqual(["far", "mid", "near"]);
    expect(straightLineTotalMeters([])).toBe(0);
    expect(supportsMultiStopEstimate("transit")).toBe(false);
  });
});

describe("Google Maps deep links", () => {
  const a = { lat: 22.5, lng: 88.3 };
  const b = { lat: 22.6, lng: 88.4 };
  const c = { lat: 22.7, lng: 88.5 };
  it("builds place and navigation links", () => {
    expect(placeUrl(a)).toBe("https://www.google.com/maps/search/?api=1&query=22.500000%2C88.300000");
    const nav = new URL(navigateUrl(a, "drive"));
    expect(nav.searchParams.get("destination")).toBe("22.500000,88.300000");
    expect(nav.searchParams.get("travelmode")).toBe("driving");
    expect(nav.searchParams.has("origin")).toBe(false);
  });
  it("puts intermediate stops in waypoints and omits the origin for an automatic start", () => {
    const [link, ...rest] = buildDirectionsLinks([a, b, c], "walk", { kind: "auto" });
    expect(rest).toHaveLength(0);
    const u = new URL(link.url);
    expect(u.searchParams.has("origin")).toBe(false);
    expect(u.searchParams.get("waypoints")).toBe("22.500000,88.300000|22.600000,88.400000");
    expect(u.searchParams.get("destination")).toBe("22.700000,88.500000");
    expect(u.searchParams.get("travelmode")).toBe("walking");
  });
  it("uses a named place as origin", () => {
    const [link] = buildDirectionsLinks([a], "two_wheeler", { kind: "place", query: "Dum Dum Metro Station" });
    const u = new URL(link.url);
    expect(u.searchParams.get("origin")).toBe("Dum Dum Metro Station");
    expect(u.searchParams.get("travelmode")).toBe("two-wheeler");
  });
  it("splits transit plans into one link per leg, chaining origins", () => {
    const links = buildDirectionsLinks([a, b, c], "transit", { kind: "auto" });
    expect(links).toHaveLength(3);
    expect(links.every((l) => !new URL(l.url).searchParams.has("waypoints"))).toBe(true);
    expect(new URL(links[1].url).searchParams.get("origin")).toBe("22.500000,88.300000");
  });
  it("never exceeds 9 waypoints in a link", () => {
    const stops = Array.from({ length: 23 }, (_, i) => ({ lat: 22.4 + i * 0.01, lng: 88.3 }));
    const links = buildDirectionsLinks(stops, "drive", { kind: "auto" });
    expect(links).toHaveLength(3);
    for (const l of links) {
      const wp = new URL(l.url).searchParams.get("waypoints");
      expect((wp ? wp.split("|") : []).length).toBeLessThanOrEqual(9);
    }
    expect(links.at(-1)?.toIndex).toBe(22);
  });
  it("returns nothing for an empty plan", () => {
    expect(buildDirectionsLinks([], "walk", { kind: "auto" })).toEqual([]);
  });
});

describe("submission schema", () => {
  const ok = { type: "new_pandal", pandalName: "Some Pandal", details: "It is on the corner of X and Y." };
  it("accepts a minimal submission and normalises blanks to null", () => {
    const s = submissionInputSchema.parse({ ...ok, sourceUrl: "", contactEmail: "" });
    expect(s.sourceUrl).toBeNull();
    expect(s.contactEmail).toBeNull();
    expect(s.lat).toBeNull();
  });
  it("rejects short details, bad URLs, bad emails and half a coordinate", () => {
    expect(submissionInputSchema.safeParse({ ...ok, details: "short" }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ ...ok, sourceUrl: "not a url" }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ ...ok, contactEmail: "nope" }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ ...ok, lat: 22.5 }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ ...ok, type: "spam" }).success).toBe(false);
  });
});
