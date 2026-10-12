import { NextResponse } from "next/server";
import { z } from "zod";
import { getPandals } from "@/lib/data/queries";
import { MAX_STOPS } from "@/lib/domain/route-plan";
import { TRAVEL_MODES, latitudeSchema, longitudeSchema } from "@/lib/domain/types";
import { estimateRoute, type RouteEstimateError, type RouteOrigin } from "@/lib/google/routes";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  // Stops are pandal slugs, resolved to coordinates here. The endpoint cannot be
  // used as a general-purpose proxy for our Google key.
  stops: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(120),
    )
    .min(1)
    .max(MAX_STOPS),
  mode: z.enum(TRAVEL_MODES),
  start: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("auto") }),
      z.object({ kind: z.literal("place"), query: z.string().trim().min(2).max(200) }),
      z.object({ kind: z.literal("geo"), lat: latitudeSchema, lng: longitudeSchema }),
    ])
    .default({ kind: "auto" }),
});

const STATUS: Record<RouteEstimateError, number> = {
  not_configured: 503,
  unsupported_mode: 422,
  too_few_points: 422,
  no_route: 404,
  upstream: 502,
};

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!rateLimit(`routes:${clientKey(request.headers)}`, 20, 60_000)) return json({ error: "rate_limited" }, 429);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const { stops, mode, start } = parsed.data;

  const bySlug = new Map((await getPandals()).map((p) => [p.slug, p]));
  const points = stops.map((s) => bySlug.get(s));
  if (points.some((p) => !p)) return json({ error: "unknown_stop" }, 422);

  const origin: RouteOrigin | null =
    start.kind === "geo"
      ? { kind: "point", point: { lat: start.lat, lng: start.lng } }
      : start.kind === "place"
        ? { kind: "address", address: start.query }
        : null;

  const result = await estimateRoute(
    origin,
    points.map((p) => ({ lat: p!.lat, lng: p!.lng })),
    mode,
  );
  if (!result.ok) return json({ error: result.error }, STATUS[result.error]);
  return json({ estimate: result.estimate }, 200);
}
