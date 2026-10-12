import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { LocalRepository } from "./local-repository";
import type { AdminRepository, PublicRepository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

const local = new LocalRepository();

/** Cookie-less client using the public anon key: sees only what row-level security allows visitors. */
export function getPublicRepository(): PublicRepository {
  if (!isSupabaseConfigured()) return local;
  return new SupabaseRepository(
    createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}

/**
 * Repository bound to the signed-in user's session. Call `requireAdmin()`
 * before using it; the database re-checks admin rights on every statement.
 */
export async function getAdminRepository(): Promise<AdminRepository> {
  if (!isSupabaseConfigured()) return local;
  return new SupabaseRepository(await createSessionClient());
}
