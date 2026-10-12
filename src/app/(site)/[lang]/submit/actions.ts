"use server";

import { headers } from "next/headers";
import { getPublicRepository } from "@/lib/data";
import { getPandals } from "@/lib/data/queries";
import { submissionInputSchema } from "@/lib/domain/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export type SubmitState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; reason: "invalid" | "failed"; fields: string[]; values: Record<string, string> };

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const number = (form: FormData, key: string) => {
  const v = text(form, key);
  if (!v) return null;
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
};

/** Echoed back on failure so the visitor does not have to retype their suggestion. */
function echo(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["pandalName", "details", "sourceUrl", "lat", "lng", "contactEmail"]) out[key] = text(form, key);
  return out;
}

export async function submitSuggestion(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  // Honeypot: real visitors never see or fill this field. Pretend it worked.
  if (text(form, "website")) return { status: "success" };

  if (!rateLimit(`submit:${clientKey(await headers())}`, 5, 10 * 60_000)) {
    return { status: "error", reason: "failed", fields: [], values: echo(form) };
  }

  // The form sends a slug; the stored reference is the pandal's ID, looked up here.
  const slug = text(form, "pandal");
  const pandal = slug ? (await getPandals()).find((p) => p.slug === slug) : undefined;

  const parsed = submissionInputSchema.safeParse({
    type: text(form, "type"),
    pandalId: pandal?.id ?? null,
    pandalName: text(form, "pandalName") || pandal?.name || "",
    details: text(form, "details"),
    sourceUrl: text(form, "sourceUrl"),
    lat: number(form, "lat"),
    lng: number(form, "lng"),
    contactEmail: text(form, "contactEmail"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))],
      values: echo(form),
    };
  }
  try {
    await getPublicRepository().createSubmission(parsed.data);
    return { status: "success" };
  } catch (err) {
    console.error("[submit] could not store submission", err instanceof Error ? err.message : err);
    return { status: "error", reason: "failed", fields: [], values: echo(form) };
  }
}
