import { describe, expect, it, vi } from "vitest";
import { buildComputeRoutesBody, estimateRoute } from "@/lib/google/routes";
import { fmt, getDictionary } from "@/lib/i18n";
import { rateLimit } from "@/lib/rate-limit";

const a = { lat: 22.5, lng: 88.3 };
const b = { lat: 22.6, lng: 88.4 };
const c = { lat: 22.7, lng: 88.5 };

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("Google Routes request", () => {
  it("uses the first stop as origin when no start is given, and the rest as intermediates", () => {
    const body = buildComputeRoutesBody(null, [a, b, c], "walk");
    expect(body.origin).toEqual({ location: { latLng: { latitude: 22.5, longitude: 88.3 } } });
    expect(body.intermediates).toHaveLength(1);
    expect(body.destination).toEqual({ location: { latLng: { latitude: 22.7, longitude: 88.5 } } });
    expect(body.travelMode).toBe("WALK");
    expect(body).not.toHaveProperty("routingPreference");
  });
  it("sends a named start as an address and keeps driving requests traffic-unaware", () => {
    const body = buildComputeRoutesBody({ kind: "address", address: "Sealdah Station" }, [a, b], "drive");
    expect(body.origin).toEqual({ address: "Sealdah Station" });
    expect(body.intermediates).toHaveLength(1);
    expect(body.routingPreference).toBe("TRAFFIC_UNAWARE");
  });
});

describe("Google Routes estimate", () => {
  it("does not call Google without an API key", async () => {
    const fetchImpl = respond(200, {});
    expect(await estimateRoute(null, [a, b], "walk", { apiKey: "", fetchImpl })).toEqual({
      ok: false,
      error: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("refuses multi-stop transit and single-point requests before calling Google", async () => {
    const fetchImpl = respond(200, {});
    expect(await estimateRoute(null, [a, b, c], "transit", { apiKey: "k", fetchImpl })).toEqual({
      ok: false,
      error: "unsupported_mode",
    });
    expect(await estimateRoute(null, [a], "walk", { apiKey: "k", fetchImpl })).toEqual({
      ok: false,
      error: "too_few_points",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("asks only for distance and duration, and keeps the key in a header", async () => {
    const fetchImpl = respond(200, {
      routes: [{ distanceMeters: 4200, duration: "3120s", legs: [{ distanceMeters: 4200, duration: "3120s" }] }],
    });
    const result = await estimateRoute(null, [a, b], "walk", { apiKey: "test-key", fetchImpl });
    expect(result).toEqual({
      ok: true,
      estimate: {
        distanceMeters: 4200,
        durationSeconds: 3120,
        legs: [{ distanceMeters: 4200, durationSeconds: 3120 }],
      },
    });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(url).not.toContain("test-key");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(headers["X-Goog-FieldMask"]).toBe(
      "routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration",
    );
    expect(init.cache).toBe("no-store");
  });
  it("maps quota errors, empty results and network failures to safe error codes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const quota = respond(429, { error: { message: "Quota exceeded for project 12345" } });
    expect(await estimateRoute(null, [a, b], "walk", { apiKey: "k", fetchImpl: quota })).toEqual({
      ok: false,
      error: "upstream",
    });
    expect(await estimateRoute(null, [a, b], "walk", { apiKey: "k", fetchImpl: respond(200, {}) })).toEqual({
      ok: false,
      error: "no_route",
    });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await estimateRoute(null, [a, b], "walk", { apiKey: "k", fetchImpl: down })).toEqual({
      ok: false,
      error: "upstream",
    });
    vi.restoreAllMocks();
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window and recovers afterwards", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 1000, 0)).toBe(true);
    expect(rateLimit(key, 2, 1000, 10)).toBe(true);
    expect(rateLimit(key, 2, 1000, 20)).toBe(false);
    expect(rateLimit(key, 2, 1000, 1001)).toBe(true);
  });
});

describe("translations", () => {
  const keysOf = (o: object, prefix = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();

  it("Bengali has every English string, with the same placeholders, and none left empty", () => {
    const en = getDictionary("en") as unknown as Record<string, unknown>;
    const bn = getDictionary("bn") as unknown as Record<string, unknown>;
    const get = (o: Record<string, unknown>, path: string) =>
      path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], o) as string;
    expect(keysOf(bn).sort()).toEqual(keysOf(en).sort());
    for (const key of keysOf(en)) {
      expect(get(bn, key).trim(), key).not.toBe("");
      expect(placeholders(get(bn, key)), key).toBe(placeholders(get(en, key)));
    }
  });
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("{count} stops from {place}", { count: 3 })).toBe("3 stops from {place}");
  });
});

describe("festival year", () => {
  it("reads a valid year from configuration and falls back to the default otherwise", async () => {
    const { parseFestivalYear, DEFAULT_FESTIVAL_YEAR } = await import("@/lib/domain/types");
    expect(parseFestivalYear("2027")).toBe(2027);
    for (const bad of [undefined, "", "next year", "27", "2026.5", "3000"]) {
      expect(parseFestivalYear(bad)).toBe(DEFAULT_FESTIVAL_YEAR);
    }
  });
  it("fills the year into both languages, with Bengali digits in Bengali", () => {
    const en = getDictionary("en");
    const bn = getDictionary("bn");
    expect(en.meta.title).toBe("PujoMap 2026");
    expect(bn.meta.title).toBe("পুজোম্যাপ ২০২৬");
    expect(JSON.stringify(en)).not.toContain("{festivalYear}");
    expect(JSON.stringify(bn)).not.toContain("{festivalYear}");
  });
});
