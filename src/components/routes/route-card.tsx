import { ArrowRight, Flag } from "lucide-react";
import Link from "next/link";
import { planToParams } from "@/lib/domain/route-plan";
import type { CuratedRoute, Pandal } from "@/lib/domain/types";
import { fmt, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";

type Props = { route: CuratedRoute; pandals: Pandal[]; lang: Locale; t: Dictionary };

export function RouteCard({ route, pandals, lang, t }: Props) {
  const byId = new Map(pandals.map((p) => [p.id, p]));
  const stops = route.stopPandalIds.map((id) => byId.get(id)).filter((p): p is Pandal => Boolean(p));
  const query = planToParams({
    stops: stops.map((p) => p.slug),
    mode: route.travelMode,
    start: route.startLabel ? { kind: "place", query: route.startLabel } : { kind: "auto" },
  });
  const title = lang === "bn" && route.titleBn ? route.titleBn : route.title;
  const description = lang === "bn" && route.descriptionBn ? route.descriptionBn : route.description;

  return (
    <article data-testid="route-card" className="bg-card flex h-full flex-col rounded-2xl border p-5">
      <p className="text-vermilion text-xs font-semibold tracking-wider uppercase">{t.regions[route.region]}</p>
      <h3 className="mt-1 text-xl leading-snug">{title}</h3>
      {description ? <p className="text-muted-foreground mt-2 text-sm">{description}</p> : null}
      <p className="mt-3 text-sm font-medium">
        {stops.length > 0 ? fmt(t.routes.stops, { count: formatNumber(stops.length, lang) }) : t.routes.noStops}
        {" · "}
        {t.plan.modes[route.travelMode]}
      </p>
      {route.startLabel ? (
        <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
          <Flag className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {fmt(t.routes.startsAt, { place: route.startLabel })}
        </p>
      ) : null}
      {stops.length > 0 ? (
        <ol className="text-muted-foreground mt-3 list-inside list-decimal space-y-0.5 text-sm">
          {stops.map((p) => (
            <li key={p.id}>{lang === "bn" && p.nameBn ? p.nameBn : p.name}</li>
          ))}
        </ol>
      ) : null}
      <div className="mt-auto pt-4">
        {stops.length > 0 ? (
          <Link
            href={`/${lang}/plan?${query}`}
            className="btn btn-primary w-full"
            aria-label={`${t.routes.open}: ${title}`}
          >
            {t.routes.open}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
