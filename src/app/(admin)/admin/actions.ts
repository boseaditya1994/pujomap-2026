"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  DEV_ADMIN_COOKIE,
  NotAuthorizedError,
  adminLoginMode,
  devCookieValue,
  devTokenMatches,
  requireAdmin,
} from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";
import { PANDALS_TAG, ROUTES_TAG } from "@/lib/data/queries";
import { RepositoryError } from "@/lib/data/repository";
import { parsePandalCsv, type CsvRowError } from "@/lib/domain/csv";
import { slugify } from "@/lib/domain/pandal";
import { curatedRouteInputSchema, pandalInputSchema } from "@/lib/domain/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Every action below starts with `requireAdmin()`. Server actions are public
 * HTTP endpoints, so hiding a button is never the access control.
 */

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** What was submitted, echoed back so a rejected form can be corrected instead of retyped. */
  values?: Record<string, string>;
};

function echo(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const optionalNumber = (form: FormData, key: string) => {
  const v = text(form, key);
  if (!v) return undefined;
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
};
const jsonField = (form: FormData, key: string): unknown => {
  try {
    return JSON.parse(text(form, key) || "[]");
  } catch {
    return null;
  }
};

function failure(err: unknown): FormState {
  if (err instanceof NotAuthorizedError) return { ok: false, message: "You are not signed in as an administrator." };
  if (err instanceof RepositoryError) return { ok: false, message: err.message };
  console.error("[admin] action failed", err);
  return { ok: false, message: "The change could not be saved. Please try again." };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// --- Sign in / out -----------------------------------------------------------

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`login:${clientKey(await headers())}`, 10, 10 * 60_000)) {
    return { ok: false, message: "Too many attempts. Wait a few minutes and try again." };
  }
  const mode = adminLoginMode();
  if (mode === "disabled") return { ok: false, message: "Admin sign-in is not configured." };

  if (mode === "dev-token") {
    if (!devTokenMatches(text(form, "token"))) return { ok: false, message: "That token is not correct." };
    (await cookies()).set(DEV_ADMIN_COOKIE, devCookieValue() as string, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  } else {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: text(form, "email"),
      password: typeof form.get("password") === "string" ? (form.get("password") as string) : "",
    });
    if (error) return { ok: false, message: "Those sign-in details were not accepted." };
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) {
      await supabase.auth.signOut();
      return { ok: false, message: "This account is not an administrator." };
    }
  }
  redirect("/admin");
}

export async function signOut() {
  if (adminLoginMode() === "supabase") await (await createSessionClient()).auth.signOut();
  (await cookies()).delete(DEV_ADMIN_COOKIE);
  redirect("/admin/login");
}

// --- Pandals -----------------------------------------------------------------

function pandalFromForm(form: FormData) {
  const name = text(form, "name");
  return pandalInputSchema.safeParse({
    name,
    nameBn: text(form, "nameBn"),
    slug: text(form, "slug") || slugify(name),
    address: text(form, "address"),
    lat: optionalNumber(form, "lat"),
    lng: optionalNumber(form, "lng"),
    neighbourhood: text(form, "neighbourhood"),
    region: text(form, "region"),
    committee: text(form, "committee"),
    description: text(form, "description"),
    themeYear: optionalNumber(form, "themeYear"),
    themeTitle: text(form, "themeTitle"),
    themeStatus: text(form, "themeStatus") || "unknown",
    themeSource: text(form, "themeSource"),
    nearestMetro: text(form, "nearestMetro"),
    openingSchedule: text(form, "openingSchedule"),
    wheelchairAccess: text(form, "wheelchairAccess") || "unknown",
    accessibilityNotes: text(form, "accessibilityNotes"),
    verificationStatus: text(form, "verificationStatus") || "unverified",
    verificationSource: text(form, "verificationSource"),
    lastVerifiedAt: text(form, "lastVerifiedAt") || null,
    images: jsonField(form, "images"),
    published: form.get("published") === "on",
  });
}

export async function savePandal(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const parsed = pandalFromForm(form);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
        values: echo(form),
      };
    }
    const repo = await getAdminRepository();
    if (id) await repo.updatePandal(id, parsed.data, actor);
    else await repo.createPandal(parsed.data, actor);
    updateTag(PANDALS_TAG);
  } catch (err) {
    return { ...failure(err), values: echo(form) };
  }
  redirect("/admin/pandals?saved=1");
}

export async function deletePandal(form: FormData) {
  const actor = await requireAdmin();
  await (await getAdminRepository()).deletePandal(text(form, "id"), actor);
  updateTag(PANDALS_TAG);
  updateTag(ROUTES_TAG);
  redirect("/admin/pandals?deleted=1");
}

// --- CSV import --------------------------------------------------------------

export type ImportState =
  | { status: "idle" }
  | { status: "invalid"; errors: CsvRowError[]; totalRows: number }
  | { status: "done"; created: number; updated: number }
  | { status: "failed"; message: string };

const MAX_CSV_BYTES = 900_000; // stays under the default 1 MB server-action body limit

export async function importPandalCsv(_prev: ImportState, form: FormData): Promise<ImportState> {
  try {
    const actor = await requireAdmin();
    const csv = form.get("csv");
    if (typeof csv !== "string" || !csv.trim()) return { status: "failed", message: "Choose a CSV file first." };
    if (csv.length > MAX_CSV_BYTES)
      return { status: "failed", message: "That file is too large. Split it into smaller files." };
    // The browser previews validation, but this server-side pass is the one that counts.
    const result = parsePandalCsv(csv);
    if (result.errors.length)
      return { status: "invalid", errors: result.errors.slice(0, 200), totalRows: result.totalRows };
    if (result.rows.length === 0) return { status: "failed", message: "The file has no data rows." };
    const summary = await (await getAdminRepository()).importPandals(result.rows, actor);
    updateTag(PANDALS_TAG);
    return { status: "done", ...summary };
  } catch (err) {
    return { status: "failed", message: failure(err).message ?? "Import failed." };
  }
}

// --- Submissions -------------------------------------------------------------

export async function reviewSubmission(form: FormData) {
  const actor = await requireAdmin();
  const decision = z.enum(["accepted", "rejected"]).parse(text(form, "decision"));
  await (await getAdminRepository()).reviewSubmission(text(form, "id"), decision, text(form, "note") || null, actor);
  // Stay on the queue and re-render it without the item that was just decided.
  revalidatePath("/admin/submissions");
}

// --- Curated routes ----------------------------------------------------------

export async function saveCuratedRoute(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const title = text(form, "title");
    const parsed = curatedRouteInputSchema.safeParse({
      slug: text(form, "slug") || slugify(title),
      region: text(form, "region"),
      title,
      titleBn: text(form, "titleBn"),
      description: text(form, "description"),
      descriptionBn: text(form, "descriptionBn"),
      startLabel: text(form, "startLabel"),
      travelMode: text(form, "travelMode") || "walk",
      stopPandalIds: jsonField(form, "stops"),
      published: form.get("published") === "on",
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
        values: echo(form),
      };
    }
    await (await getAdminRepository()).saveCuratedRoute(id, parsed.data, actor);
    updateTag(ROUTES_TAG);
  } catch (err) {
    return { ...failure(err), values: echo(form) };
  }
  redirect("/admin/routes?saved=1");
}

export async function deleteCuratedRoute(form: FormData) {
  const actor = await requireAdmin();
  await (await getAdminRepository()).deleteCuratedRoute(text(form, "id"), actor);
  updateTag(ROUTES_TAG);
  redirect("/admin/routes?deleted=1");
}
