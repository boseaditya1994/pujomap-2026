import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

export const DEV_ADMIN_COOKIE = "pujomap_dev_admin";
const MIN_DEV_TOKEN_LENGTH = 16;

/**
 * Local-development admin access. It exists only when Supabase is NOT
 * configured and PUJOMAP_DEV_ADMIN_TOKEN is set to a long random value.
 * With Supabase configured this path is ignored entirely.
 */
export function devAdminToken(): string | null {
  if (isSupabaseConfigured()) return null;
  const token = process.env.PUJOMAP_DEV_ADMIN_TOKEN ?? "";
  return token.length >= MIN_DEV_TOKEN_LENGTH ? token : null;
}

const digest = (v: string) => createHash("sha256").update(v).digest();

export function devTokenMatches(candidate: string): boolean {
  const token = devAdminToken();
  return token !== null && timingSafeEqual(digest(candidate), digest(token));
}

export function devCookieValue(): string | null {
  const token = devAdminToken();
  return token ? digest(`cookie:${token}`).toString("hex") : null;
}

export function adminLoginMode(): "supabase" | "dev-token" | "disabled" {
  if (isSupabaseConfigured()) return "supabase";
  return devAdminToken() ? "dev-token" : "disabled";
}

/** Returns the signed-in administrator, or null. Always evaluated on the server. */
export async function getAdmin(): Promise<Actor | null> {
  // Read the request's cookies before anything else: this guarantees every admin
  // page is rendered per request and can never be prerendered as a static page.
  const cookieStore = await cookies();
  if (isSupabaseConfigured()) {
    const supabase = await createSessionClient();
    // getUser() validates the token with Supabase Auth rather than trusting the cookie.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
    if (rpcError || isAdmin !== true) return null;
    return { id: data.user.id, email: data.user.email ?? data.user.id };
  }
  const expected = devCookieValue();
  if (!expected) return null;
  const got = cookieStore.get(DEV_ADMIN_COOKIE)?.value ?? "";
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return null;
  return { id: "dev-admin", email: "dev-admin@localhost" };
}

/** For pages: redirects visitors who are not administrators to the login page. */
export async function requireAdminPage(): Promise<Actor> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Not authorised");
    this.name = "NotAuthorizedError";
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireAdmin(): Promise<Actor> {
  const admin = await getAdmin();
  if (!admin) throw new NotAuthorizedError();
  return admin;
}
