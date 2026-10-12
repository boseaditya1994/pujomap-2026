"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { PandalCard } from "@/components/pandal/pandal-card";
import { EmptyState } from "@/components/states";
import { useFavourites, useSavedPlans, useVisited } from "@/lib/client/storage";
import type { Pandal } from "@/lib/domain/types";
import { fmt, formatNumber } from "@/lib/i18n";

export function SavedClient({ pandals }: { pandals: Pandal[] }) {
  const { t, lang } = useI18n();
  const favourites = useFavourites();
  const visited = useVisited();
  const { plans, remove } = useSavedPlans();

  const bySlug = new Map(pandals.map((p) => [p.slug, p]));
  const pick = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((p): p is Pandal => Boolean(p));
  const favList = pick(favourites.ids);
  const visitedList = pick(visited.ids);
  const explore = (
    <Link href={`/${lang}/explore`} className="btn btn-outline">
      {t.saved.explore}
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl">{t.saved.title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t.saved.localNote}</p>

      <section aria-labelledby="fav-heading" className="mt-8">
        <h2 id="fav-heading" className="text-2xl">
          {t.saved.favourites}
        </h2>
        {favList.length === 0 ? (
          <EmptyState className="mt-4" title={t.saved.emptyFavTitle} body={t.saved.emptyFavBody}>
            {explore}
          </EmptyState>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2" data-testid="favourites-list">
            {favList.map((p) => (
              <li key={p.id}>
                <PandalCard pandal={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="visited-heading" className="mt-10">
        <h2 id="visited-heading" className="text-2xl">
          {t.saved.visited}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm" data-testid="visited-progress">
          {fmt(t.saved.progress, {
            visited: formatNumber(visitedList.length, lang),
            total: formatNumber(pandals.length, lang),
          })}
        </p>
        {visitedList.length === 0 ? (
          <EmptyState className="mt-4" title={t.saved.emptyVisitedTitle} body={t.saved.emptyVisitedBody}>
            {explore}
          </EmptyState>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2" data-testid="visited-list">
            {visitedList.map((p) => (
              <li key={p.id}>
                <PandalCard pandal={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="plans-heading" className="mt-10">
        <h2 id="plans-heading" className="text-2xl">
          {t.saved.plans}
        </h2>
        {plans.length === 0 ? (
          <EmptyState className="mt-4" title={t.saved.emptyPlansTitle} body={t.saved.emptyPlansBody}>
            <Link href={`/${lang}/plan`} className="btn btn-outline">
              {t.nav.plan}
            </Link>
          </EmptyState>
        ) : (
          <ul className="mt-4 space-y-2" data-testid="saved-plans">
            {plans.map((plan) => (
              <li key={plan.id} className="bg-card flex items-center justify-between gap-3 rounded-xl border p-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{plan.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {fmt(t.saved.planStops, { count: formatNumber(plan.stopCount, lang) })}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Link
                    href={`/${lang}/plan?${plan.query}`}
                    className="btn btn-primary btn-sm"
                    aria-label={`${t.saved.openPlan}: ${plan.name}`}
                  >
                    {t.saved.openPlan}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-destructive px-2"
                    aria-label={fmt(t.saved.deletePlan, { name: plan.name })}
                    onClick={() => remove(plan.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
