"use client";

import { List, LocateFixed, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { PandalMap } from "@/components/map/pandal-map";
import type { MapPoint } from "@/components/map/types";
import { PandalCard } from "@/components/pandal/pandal-card";
import { EmptyState, Notice } from "@/components/states";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { LatLng } from "@/lib/domain/geo";
import {
  EMPTY_FILTERS,
  filterPandals,
  filtersFromParams,
  filtersToParams,
  neighbourhoodsOf,
  parseRegion,
  type PandalFilters,
} from "@/lib/domain/pandal";
import { REGIONS, type Pandal } from "@/lib/domain/types";
import { fmt, formatNumber } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type GeoState = "idle" | "locating" | "denied" | "unavailable";

export function ExploreClient({ pandals }: { pandals: Pandal[] }) {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<PandalFilters>(() => filtersFromParams(new URLSearchParams(searchParams)));
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const ids = { q: `${uid}q` };

  // Keep the address bar shareable. The visitor's position is never written to it.
  useEffect(() => {
    const qs = filtersToParams(filters).toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(null, "", url);
  }, [filters]);

  const results = useMemo(() => filterPandals(pandals, filters), [pandals, filters]);
  const neighbourhoods = useMemo(() => neighbourhoodsOf(pandals, filters.region), [pandals, filters.region]);
  const points = useMemo<MapPoint[]>(
    () =>
      results.map((p) => ({
        id: p.id,
        name: lang === "bn" && p.nameBn ? p.nameBn : p.name,
        lat: p.lat,
        lng: p.lng,
        verified: p.verificationStatus === "verified",
      })),
    [results, lang],
  );
  const selected = results.find((p) => p.id === selectedId) ?? null;
  const hasFilters = Boolean(
    filters.q || filters.region || filters.neighbourhood || filters.verifiedOnly || filters.near,
  );

  const patch = (next: Partial<PandalFilters>) => setFilters((f) => ({ ...f, ...next }));

  function selectFromMap(id: string | null) {
    setSelectedId(id);
    if (!id) return;
    // On wide screens the list sits beside the map: bring the matching card into view.
    const card = listRef.current?.querySelector<HTMLElement>(`[data-pandal-row="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function toggleNearMe() {
    if (filters.near) {
      patch({ near: null });
      setGeo("idle");
      return;
    }
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("locating");
    // Permission is requested only here, in direct response to the visitor's tap.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({ near: { lat: pos.coords.latitude, lng: pos.coords.longitude } as LatLng });
        setGeo("idle");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // Rendered twice (sidebar on wide screens, bottom sheet on small ones), so ids take a prefix.
  const filterControls = (where: "side" | "sheet") => {
    const fid = { region: `${uid}${where}-region`, area: `${uid}${where}-area`, verified: `${uid}${where}-verified` };
    return (
      <div className="grid gap-3">
        <div>
          <label className="field-label" htmlFor={fid.region}>
            {t.explore.region}
          </label>
          <select
            id={fid.region}
            className="field"
            value={filters.region ?? ""}
            onChange={(e) => patch({ region: parseRegion(e.target.value), neighbourhood: null })}
          >
            <option value="">{t.regions.all}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {t.regions[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={fid.area}>
            {t.explore.neighbourhood}
          </label>
          <select
            id={fid.area}
            className="field"
            value={filters.neighbourhood ?? ""}
            onChange={(e) => patch({ neighbourhood: e.target.value || null })}
          >
            <option value="">{t.explore.allNeighbourhoods}</option>
            {neighbourhoods.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label
          htmlFor={fid.verified}
          className="border-input bg-card flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3"
        >
          <input
            id={fid.verified}
            type="checkbox"
            className="size-5 accent-[var(--maroon)]"
            checked={filters.verifiedOnly}
            onChange={(e) => patch({ verifiedOnly: e.target.checked })}
          />
          <span className="text-sm font-medium">{t.explore.verifiedOnly}</span>
        </label>
      </div>
    );
  };

  const count =
    results.length === 1 ? t.explore.resultsOne : fmt(t.explore.results, { count: formatNumber(results.length, lang) });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section
        aria-label={t.explore.title}
        className={cn(
          "flex min-h-0 flex-col lg:w-[440px] lg:shrink-0 lg:border-r",
          view === "map" ? "max-lg:flex-none" : "flex-1",
        )}
      >
        <div className="bg-card/60 space-y-3 border-b p-4">
          <h1 className="text-2xl">{t.explore.title}</h1>
          <div className="relative" role="search">
            <label htmlFor={ids.q} className="sr-only">
              {t.explore.searchLabel}
            </label>
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id={ids.q}
              type="search"
              inputMode="search"
              autoComplete="off"
              className="field pl-9"
              placeholder={t.explore.searchPlaceholder}
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn("btn btn-outline btn-sm", filters.near && "border-maroon bg-secondary")}
              aria-pressed={Boolean(filters.near)}
              disabled={geo === "locating"}
              onClick={toggleNearMe}
              data-testid="near-me"
            >
              <LocateFixed className="size-4" aria-hidden />
              {geo === "locating" ? t.explore.locating : filters.near ? t.explore.nearMeOff : t.explore.nearMe}
            </button>

            <Sheet>
              <SheetTrigger className="btn btn-outline btn-sm lg:hidden" data-testid="open-filters">
                <SlidersHorizontal className="size-4" aria-hidden />
                {t.explore.filters}
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>{t.explore.filters}</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">{filterControls("sheet")}</div>
              </SheetContent>
            </Sheet>

            {hasFilters ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setGeo("idle");
                }}
              >
                <X className="size-4" aria-hidden />
                {t.explore.clearFilters}
              </button>
            ) : null}

            <div
              role="group"
              aria-label={t.explore.viewToggle}
              className="border-input bg-card ml-auto flex rounded-lg border p-0.5 lg:hidden"
            >
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  data-testid={`view-${v}`}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold",
                    view === v ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {v === "list" ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
                  {v === "list" ? t.explore.list : t.explore.map}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">{filterControls("side")}</div>

          {geo === "denied" ? <Notice tone="info">{t.explore.locationDenied}</Notice> : null}
          {geo === "unavailable" ? <Notice tone="info">{t.explore.locationUnavailable}</Notice> : null}

          <p className="text-muted-foreground text-sm" role="status" aria-live="polite" data-testid="result-count">
            {count}
            {filters.near ? ` · ${t.explore.nearMeOn}` : ""}
          </p>
        </div>

        <div
          ref={listRef}
          className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto p-4", view === "map" && "max-lg:hidden")}
          data-testid="pandal-list"
        >
          {pandals.length === 0 ? (
            <EmptyState title={t.explore.emptyTitle} body={t.explore.emptyBody} />
          ) : results.length === 0 ? (
            <EmptyState title={t.explore.noResultsTitle} body={t.explore.noResultsBody}>
              <button type="button" className="btn btn-outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                {t.explore.clearFilters}
              </button>
            </EmptyState>
          ) : (
            results.map((p) => (
              <div key={p.id} data-pandal-row={p.id}>
                <PandalCard
                  pandal={p}
                  headingLevel="h2"
                  selected={p.id === selectedId}
                  onSelect={() => setSelectedId(p.id)}
                />
              </div>
            ))
          )}
        </div>
      </section>

      <section className={cn("relative min-h-0 flex-1", view === "list" && "max-lg:hidden")}>
        <PandalMap
          points={points}
          selectedId={selectedId}
          onSelect={selectFromMap}
          userLocation={filters.near}
          className="absolute inset-0"
        />
        {selected ? (
          <div
            role="region"
            aria-label={fmt(t.map.selected, { name: selected.name })}
            data-testid="map-sheet"
            className="bg-background absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-2xl border-t p-3 shadow-[0_-8px_24px_rgba(43,17,20,0.18)] lg:hidden"
          >
            <div aria-hidden className="bg-input mx-auto mb-2 h-1 w-10 rounded-full" />
            <div className="mb-2 flex justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
                <X className="size-4" aria-hidden />
                {t.common.close}
              </button>
            </div>
            <PandalCard pandal={selected} headingLevel="h2" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
