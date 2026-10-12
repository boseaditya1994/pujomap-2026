import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CuratedRoute, Pandal } from "@/lib/domain/types";
import { getPublicRepository } from "./index";

export const PANDALS_TAG = "pandals";
export const ROUTES_TAG = "curated-routes";

/**
 * The published directory. It is a few hundred small rows, so pages load it
 * once from the cache and filter in memory; admin writes expire the tag.
 */
export async function getPandals(): Promise<Pandal[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PANDALS_TAG);
  return getPublicRepository().listPandals();
}

export async function getPandalBySlug(slug: string): Promise<Pandal | null> {
  return (await getPandals()).find((p) => p.slug === slug) ?? null;
}

export async function getCuratedRoutes(): Promise<CuratedRoute[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ROUTES_TAG);
  return getPublicRepository().listCuratedRoutes();
}
