import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPandals } from "@/lib/data/queries";
import { EMPTY_FILTERS, filterPandals } from "@/lib/domain/pandal";
import { REGIONS, latitudeSchema, longitudeSchema } from "@/lib/domain/types";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const querySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    region: z.enum(REGIONS).optional(),
    verified: z.enum(["0", "1"]).optional(),
    lat: z.coerce.number().pipe(latitudeSchema).optional(),
    lng: z.coerce.number().pipe(longitudeSchema).optional(),
    radius: z.coerce.number().min(100).max(50_000).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: "lat and lng go together" });

/**
 * Public search endpoint: full-text + distance search over published pandals.
 * With Supabase it runs the PostGIS `search_pandals` function; in local mode it
 * applies the same filters in memory. The site's own pages do not call it (they
 * filter the cached directory in the browser); it exists for integrations.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(`pandals:${clientKey(request.headers)}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { q, region, verified, lat, lng, radius, limit = 200 } = parsed.data;

  if (isSupabaseConfigured()) {
    const db = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("search_pandals", {
      q: q ?? null,
      p_region: region ?? null,
      verified_only: verified === "1",
      p_lat: lat ?? null,
      p_lng: lng ?? null,
      radius_m: radius ?? null,
      max_rows: limit,
    });
    if (error) {
      console.error("[api/pandals] search failed", error.message);
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ results: data });
  }

  const results = filterPandals(await getPandals(), {
    ...EMPTY_FILTERS,
    q: q ?? "",
    region: region ?? null,
    verifiedOnly: verified === "1",
    near: lat !== undefined && lng !== undefined ? { lat, lng } : null,
    radiusM: radius ?? null,
  })
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      neighbourhood: p.neighbourhood,
      region: p.region,
      latitude: p.lat,
      longitude: p.lng,
      verification_status: p.verificationStatus,
      distance_m: p.distanceM ?? null,
    }));
  return NextResponse.json({ results });
}
