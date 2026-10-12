"use client";

import { useCallback, useSyncExternalStore } from "react";
import { EMPTY_PLAN, MAX_STOPS, type RoutePlan } from "@/lib/domain/route-plan";
import { TRAVEL_MODES, type TravelMode } from "@/lib/domain/types";

/**
 * Small localStorage-backed stores. Favourites, visited pandals and saved
 * plans live on the visitor's device only; nothing here is sent to a server.
 */

const PREFIX = "pujomap:";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read<T>(key: string, parse: (v: unknown) => T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    // Storage can be blocked (private mode); fall through to the default.
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T;
  try {
    value = parse(raw === null ? undefined : JSON.parse(raw));
  } catch {
    value = parse(undefined);
  }
  cache.set(key, { raw, value });
  return value;
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota / blocked-storage errors: the feature simply does not persist.
  }
  listeners.forEach((l) => l());
}

function useStored<T>(key: string, parse: (v: unknown) => T, serverValue: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, parse),
    () => serverValue,
  );
  const set = useCallback((next: T) => write(key, next), [key]);
  return [value, set] as const;
}

const EMPTY: string[] = [];
const parseIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 2000) : EMPTY;

function useIdSet(key: string) {
  const [ids, setIds] = useStored(key, parseIds, EMPTY);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    [ids, setIds],
  );
  return { ids, has, toggle };
}

/** Keyed by pandal slug so saved items survive database re-imports. */
export const useFavourites = () => useIdSet("favourites");
export const useVisited = () => useIdSet("visited");

function parsePlan(v: unknown): RoutePlan {
  if (!v || typeof v !== "object") return EMPTY_PLAN;
  const o = v as Record<string, unknown>;
  const stops = parseIds(o.stops)
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, MAX_STOPS);
  const mode = (TRAVEL_MODES as readonly string[]).includes(o.mode as string) ? (o.mode as TravelMode) : "walk";
  const from = typeof o.from === "string" ? o.from.slice(0, 200) : "";
  return { stops, mode, start: from ? { kind: "place", query: from } : { kind: "auto" } };
}

/** The plan being built. A device location is never persisted. */
export function useDraftPlan() {
  const [plan] = useStored("plan", parsePlan, EMPTY_PLAN);
  const setPlan = useCallback(
    (next: RoutePlan) =>
      write("plan", {
        stops: next.stops,
        mode: next.mode,
        from: next.start.kind === "place" ? next.start.query : "",
      }),
    [],
  );
  return [plan, setPlan] as const;
}

export type SavedPlan = { id: string; name: string; query: string; stopCount: number; savedAt: string };

const NO_PLANS: SavedPlan[] = [];
const parseSavedPlans = (v: unknown): SavedPlan[] =>
  Array.isArray(v)
    ? v
        .filter(
          (p): p is SavedPlan =>
            !!p &&
            typeof p === "object" &&
            typeof p.id === "string" &&
            typeof p.name === "string" &&
            typeof p.query === "string" &&
            typeof p.stopCount === "number",
        )
        .slice(0, 50)
    : NO_PLANS;

export function useSavedPlans() {
  const [plans, setPlans] = useStored("saved-plans", parseSavedPlans, NO_PLANS);
  const save = useCallback(
    (name: string, query: string, stopCount: number) =>
      setPlans([{ id: crypto.randomUUID(), name, query, stopCount, savedAt: new Date().toISOString() }, ...plans]),
    [plans, setPlans],
  );
  const remove = useCallback((id: string) => setPlans(plans.filter((p) => p.id !== id)), [plans, setPlans]);
  return { plans, save, remove };
}
