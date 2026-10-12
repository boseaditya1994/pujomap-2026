/**
 * Central place for reading configuration. NEXT_PUBLIC_* values are inlined
 * into the browser bundle; everything else is server-only.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  googleMapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** "supabase" in production; "local" is the in-memory development fallback with sample data. */
export function dataMode(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}
