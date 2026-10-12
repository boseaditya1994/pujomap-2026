"use client";

import { ArrowDown, ArrowUp, ExternalLink, Link2, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { VerificationBadge } from "@/components/pandal/badges";
import { EmptyState, Notice } from "@/components/states";
import { useDraftPlan, useSavedPlans } from "@/lib/client/storage";
import { buildDirectionsLinks } from "@/lib/domain/deeplinks";
import { formatDistance, type LatLng } from "@/lib/domain/geo";
import { matchesQuery } from "@/lib/domain/pandal";
import {
  MAX_STOPS,
  addStop,
  moveStop,
  nearestFirstOrder,
  planFromParams,
  planToParams,
  removeStop,
  straightLineTotalMeters,
  supportsMultiStopEstimate,
  type PlanStart,
  type RoutePlan,
} from "@/lib/domain/route-plan";
import { TRAVEL_MODES, type Pandal, type TravelMode } from "@/lib/domain/types";
import type { RouteEstimate } from "@/lib/google/routes";
import { fmt, formatNumber } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type EstimateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; yours: RouteEstimate; nearest: RouteEstimate | null; nearestOrder: string[] | null };

function formatDuration(totalSeconds: number, lang: string): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const nf = new Intl.NumberFormat(lang === "bn" ? "bn-IN" : "en-IN");
  if (lang === "bn") return h ? `${nf.format(h)} ঘণ্টা ${nf.format(m)} মিনিট` : `${nf.format(m)} মিনিট`;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function PlannerClient({ pandals }: { pandals: Pandal[] }) {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useDraftPlan();
  const { save: savePlan } = useSavedPlans();
  const ids = { search: useId(), place: useId(), name: useId() };

  // A shared link (?stops=...) is shown as-is and only replaces the stored draft once edited.
  const urlPlan = useMemo(() => planFromParams(new URLSearchParams(searchParams)), [searchParams]);
  const fromUrl = urlPlan.stops.length > 0;

  const [geo, setGeo] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const stored = fromUrl ? urlPlan : draft;
  const plan: RoutePlan = useMemo(() => (geo ? { ...stored, start: { kind: "geo", ...geo } } : stored), [stored, geo]);

  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [estimate, setEstimate] = useState<EstimateState>({ status: "idle" });

  const bySlug = useMemo(() => new Map(pandals.map((p) => [p.slug, p])), [pandals]);
  const stops = useMemo(
    () => plan.stops.map((s) => bySlug.get(s)).filter((p): p is Pandal => Boolean(p)),
    [plan.stops, bySlug],
  );
  const missing = plan.stops.length - stops.length;
  const displayName = (p: Pandal) => (lang === "bn" && p.nameBn ? p.nameBn : p.name);

  function update(next: RoutePlan) {
    setDraft(next);
    setEstimate({ status: "idle" });
    const qs = planToParams(next).toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 4000);
  }

  function add(slug: string) {
    const result = addStop(plan, slug);
    if (result.ok) {
      update(result.plan);
      setQuery("");
    } else if (result.reason === "limit") flash(fmt(t.plan.limit, { max: MAX_STOPS }));
  }

  function setStart(kind: PlanStart["kind"]) {
    setGeoError(null);
    if (kind !== "geo") setGeo(null);
    if (kind === "auto") return update({ ...stored, start: { kind: "auto" } });
    if (kind === "place")
      return update({
        ...stored,
        start: { kind: "place", query: stored.start.kind === "place" ? stored.start.query : "" },
      });
    if (!("geolocation" in navigator)) return setGeoError(t.explore.locationUnavailable);
    // Asked for only when the visitor picks "My current location".
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        update({ ...stored, start: { kind: "auto" } });
      },
      (err) =>
        setGeoError(err.code === err.PERMISSION_DENIED ? t.explore.locationDenied : t.explore.locationUnavailable),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return pandals.filter((p) => !plan.stops.includes(p.slug) && matchesQuery(p, query)).slice(0, 6);
  }, [pandals, plan.stops, query]);

  const originPoint: LatLng | null = plan.start.kind === "geo" ? plan.start : null;
  const straightLine = straightLineTotalMeters(originPoint ? [originPoint, ...stops] : stops);
  const links = useMemo(() => buildDirectionsLinks(stops, plan.mode, plan.start), [stops, plan.mode, plan.start]);
  const canEstimate = stops.length + (plan.start.kind === "auto" ? 0 : 1) >= 2;
  const multiStop = stops.length + (plan.start.kind === "auto" ? 0 : 1) > 2;
  const estimateBlockedByMode = multiStop && !supportsMultiStopEstimate(plan.mode);

  async function requestEstimate(stopSlugs: string[]): Promise<RouteEstimate> {
    const res = await fetch("/api/routes/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops: stopSlugs, mode: plan.mode, start: plan.start }),
    });
    const data = (await res.json().catch(() => ({}))) as { estimate?: RouteEstimate; error?: string };
    if (res.ok && data.estimate) return data.estimate;
    const messages: Record<string, string> = {
      not_configured: t.plan.notConfigured,
      unsupported_mode: t.plan.transitUnsupported,
      no_route: t.plan.noRoute,
      rate_limited: t.plan.rateLimited,
    };
    throw new Error(messages[data.error ?? ""] ?? t.plan.unavailable);
  }

  async function runEstimate(compare: boolean) {
    setEstimate({ status: "loading" });
    try {
      const slugs = stops.map((p) => p.slug);
      const yours = await requestEstimate(slugs);
      let nearest: RouteEstimate | null = null;
      let nearestOrder: string[] | null = null;
      if (compare) {
        const reordered = nearestFirstOrder(stops, originPoint ?? undefined).map((p) => p.slug);
        if (reordered.join() !== slugs.join()) {
          nearest = await requestEstimate(reordered);
          nearestOrder = reordered;
        } else {
          nearest = yours;
        }
      }
      setEstimate({ status: "done", yours, nearest, nearestOrder });
    } catch (err) {
      setEstimate({ status: "error", message: err instanceof Error ? err.message : t.plan.unavailable });
    }
  }

  async function copyShareLink() {
    const qs = planToParams(plan).toString();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`);
      flash(t.pandal.copied);
    } catch {
      // Clipboard access refused; the address bar already holds the same link.
    }
  }

  const startKind = plan.start.kind;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl">{t.plan.title}</h1>
      <p className="text-muted-foreground mt-2">{t.plan.intro}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <fieldset className="bg-card rounded-2xl border p-4">
          <legend className="px-1 text-sm font-semibold">{t.plan.start}</legend>
          <div className="space-y-1">
            {(["auto", "geo", "place"] as const).map((kind) => (
              <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="start-kind"
                  className="size-5 accent-[var(--maroon)]"
                  checked={startKind === kind}
                  onChange={() => setStart(kind)}
                />
                <span className="text-sm">
                  {kind === "auto" ? t.plan.startAuto : kind === "geo" ? t.plan.startGeo : t.plan.startPlace}
                </span>
              </label>
            ))}
          </div>
          {startKind === "place" ? (
            <div className="mt-2">
              <label htmlFor={ids.place} className="field-label">
                {t.plan.startPlaceLabel}
              </label>
              <input
                id={ids.place}
                className="field"
                maxLength={200}
                placeholder={t.plan.startPlacePlaceholder}
                value={plan.start.kind === "place" ? plan.start.query : ""}
                onChange={(e) => update({ ...stored, start: { kind: "place", query: e.target.value } })}
              />
            </div>
          ) : null}
          {geoError ? <Notice className="mt-2">{geoError}</Notice> : null}
        </fieldset>

        <fieldset className="bg-card rounded-2xl border p-4">
          <legend className="px-1 text-sm font-semibold">{t.plan.mode}</legend>
          <div className="grid grid-cols-2 gap-2">
            {TRAVEL_MODES.map((mode: TravelMode) => (
              <label
                key={mode}
                className={cn(
                  "has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-semibold has-focus-visible:ring-3",
                  plan.mode === mode ? "border-maroon bg-primary text-primary-foreground" : "border-input bg-card",
                )}
              >
                <input
                  type="radio"
                  name="travel-mode"
                  value={mode}
                  className="sr-only"
                  checked={plan.mode === mode}
                  onChange={() => update({ ...stored, mode })}
                />
                {t.plan.modes[mode]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <section aria-labelledby="stops-heading" className="mt-8">
        <h2 id="stops-heading" className="text-2xl">
          {t.plan.stops}{" "}
          <span className="text-muted-foreground font-sans text-base" data-testid="stop-count">
            {formatNumber(stops.length, lang)}/{formatNumber(MAX_STOPS, lang)}
          </span>
        </h2>

        <div className="relative mt-3">
          <label htmlFor={ids.search} className="field-label">
            {t.plan.addStop}
          </label>
          <input
            id={ids.search}
            type="search"
            className="field"
            autoComplete="off"
            placeholder={t.plan.searchStops}
            value={query}
            disabled={stops.length >= MAX_STOPS}
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 ? (
            <ul className="bg-card mt-2 divide-y rounded-xl border" data-testid="stop-suggestions">
              {suggestions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{displayName(p)}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {p.neighbourhood} · {t.regions[p.region]}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm shrink-0"
                    onClick={() => add(p.slug)}
                    aria-label={`${t.plan.add}: ${displayName(p)}`}
                  >
                    <Plus className="size-4" aria-hidden />
                    {t.plan.add}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {stops.length >= MAX_STOPS ? (
            <p className="field-hint">{fmt(t.plan.limit, { max: formatNumber(MAX_STOPS, lang) })}</p>
          ) : null}
        </div>

        {missing > 0 ? <Notice className="mt-3">{t.plan.unknownStop}</Notice> : null}

        {stops.length === 0 ? (
          <EmptyState className="mt-4" title={t.plan.emptyTitle} body={t.plan.emptyBody}>
            <Link href={`/${lang}/routes`} className="btn btn-outline">
              {t.plan.browseRoutes}
            </Link>
          </EmptyState>
        ) : (
          <ol className="mt-4 space-y-2" data-testid="plan-stops">
            {stops.map((p, i) => (
              <li key={p.id} data-slug={p.slug} className="bg-card flex items-center gap-3 rounded-xl border p-3">
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                >
                  {formatNumber(i + 1, lang)}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/${lang}/pandals/${p.slug}`}
                    className="block truncate font-semibold underline-offset-4 hover:underline"
                  >
                    {displayName(p)}
                  </Link>
                  <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    {p.neighbourhood}
                    <VerificationBadge status={p.verificationStatus} t={t} />
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm px-2"
                    disabled={i === 0}
                    aria-label={fmt(t.plan.moveUp, { name: displayName(p) })}
                    onClick={() => update(moveStop(plan, plan.stops.indexOf(p.slug), -1))}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm px-2"
                    disabled={i === stops.length - 1}
                    aria-label={fmt(t.plan.moveDown, { name: displayName(p) })}
                    onClick={() => update(moveStop(plan, plan.stops.indexOf(p.slug), 1))}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-destructive px-2"
                    aria-label={fmt(t.plan.remove, { name: displayName(p) })}
                    onClick={() => update(removeStop(plan, p.slug))}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {stops.length > 0 ? (
        <>
          <section aria-labelledby="summary-heading" className="bg-card mt-8 rounded-2xl border p-4">
            <h2 id="summary-heading" className="sr-only">
              {t.plan.estimateTitle}
            </h2>
            {stops.length > 1 || originPoint ? (
              <>
                <p className="text-sm font-semibold">
                  {t.plan.straightLine}: <span data-testid="straight-line">{formatDistance(straightLine, lang)}</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{t.plan.straightLineNote}</p>
              </>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline"
                disabled={!canEstimate || estimateBlockedByMode || estimate.status === "loading"}
                onClick={() => runEstimate(false)}
                data-testid="estimate"
              >
                {estimate.status === "loading" ? t.plan.estimating : t.plan.estimate}
              </button>
              {stops.length > 2 ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={estimateBlockedByMode || estimate.status === "loading"}
                  onClick={() => runEstimate(true)}
                >
                  {t.plan.compare}
                </button>
              ) : null}
            </div>
            {estimateBlockedByMode ? <Notice className="mt-3">{t.plan.transitUnsupported}</Notice> : null}
            {estimate.status === "error" ? (
              <Notice tone="error" className="mt-3">
                {estimate.message}
              </Notice>
            ) : null}
            {estimate.status === "done" ? (
              <div className="mt-4" data-testid="estimate-result">
                <table className="w-full text-left text-sm">
                  <caption className="text-muted-foreground mb-2 text-left text-sm">{t.plan.estimateSource}</caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="py-1.5 font-semibold" />
                      <th scope="col" className="py-1.5 font-semibold">
                        {t.plan.distance}
                      </th>
                      <th scope="col" className="py-1.5 font-semibold">
                        {t.plan.duration}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <th scope="row" className="py-1.5 font-medium">
                        {t.plan.yourOrder}
                      </th>
                      <td>{formatDistance(estimate.yours.distanceMeters, lang)}</td>
                      <td>{formatDuration(estimate.yours.durationSeconds, lang)}</td>
                    </tr>
                    {estimate.nearest ? (
                      <tr>
                        <th scope="row" className="py-1.5 font-medium">
                          {t.plan.nearestOrder}
                        </th>
                        <td>{formatDistance(estimate.nearest.distanceMeters, lang)}</td>
                        <td>{formatDuration(estimate.nearest.durationSeconds, lang)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {estimate.nearest ? <p className="text-muted-foreground mt-2 text-sm">{t.plan.compareNote}</p> : null}
                {estimate.nearestOrder ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-2"
                    onClick={() => update({ ...stored, stops: estimate.nearestOrder as string[] })}
                  >
                    {t.plan.useThisOrder}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-6 space-y-2" aria-label={t.plan.openInMaps}>
            {links.length > 1 ? (
              <p className="text-muted-foreground text-sm">
                {fmt(t.plan.legsNote, { count: formatNumber(links.length, lang) })}
              </p>
            ) : null}
            {links.map((link, i) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent w-full text-base"
                data-testid="open-in-maps"
              >
                <ExternalLink className="size-4" aria-hidden />
                {links.length === 1 ? t.plan.openInMaps : fmt(t.plan.openLeg, { n: formatNumber(i + 1, lang) })}
              </a>
            ))}
          </section>

          <section className="bg-card mt-6 rounded-2xl border p-4">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                savePlan(planName.trim() || t.plan.planNameDefault, planToParams(plan).toString(), stops.length);
                setPlanName("");
                flash(t.plan.planSaved);
              }}
            >
              <div className="flex-1">
                <label htmlFor={ids.name} className="field-label">
                  {t.plan.planName}
                </label>
                <input
                  id={ids.name}
                  className="field"
                  maxLength={80}
                  placeholder={t.plan.planNameDefault}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" data-testid="save-plan">
                <Save className="size-4" aria-hidden />
                {t.plan.savePlan}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={copyShareLink}>
                <Link2 className="size-4" aria-hidden />
                {t.plan.share}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-destructive"
                onClick={() => update({ ...stored, stops: [] })}
              >
                <Trash2 className="size-4" aria-hidden />
                {t.plan.clear}
              </button>
            </div>
          </section>
        </>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="text-verified mt-4 min-h-5 text-sm font-medium"
        data-testid="plan-message"
      >
        {message}
      </p>
    </div>
  );
}
