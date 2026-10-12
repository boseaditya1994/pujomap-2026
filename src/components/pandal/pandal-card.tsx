"use client";

import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { navigateUrl } from "@/lib/domain/deeplinks";
import { formatDistance } from "@/lib/domain/geo";
import type { PandalWithDistance } from "@/lib/domain/pandal";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DemoBadge, ThemeLine, VerificationBadge } from "./badges";
import { PandalActions } from "./pandal-actions";

type Props = {
  pandal: PandalWithDistance;
  selected?: boolean;
  onSelect?: () => void;
  headingLevel?: "h2" | "h3";
};

export function PandalCard({ pandal, selected = false, onSelect, headingLevel: Heading = "h3" }: Props) {
  const { t, lang } = useI18n();
  const displayName = lang === "bn" && pandal.nameBn ? pandal.nameBn : pandal.name;
  return (
    <article
      data-testid="pandal-card"
      data-slug={pandal.slug}
      data-selected={selected || undefined}
      className={cn(
        "bg-card rounded-2xl border p-4 shadow-xs transition-shadow",
        selected && "border-vermilion ring-vermilion/30 ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-lg leading-snug">
            <Link
              href={`/${lang}/pandals/${pandal.slug}`}
              className="underline-offset-4 hover:underline"
              onFocus={onSelect}
              onMouseEnter={onSelect}
            >
              {displayName}
            </Link>
          </Heading>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {pandal.neighbourhood} · {t.regions[pandal.region]}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <VerificationBadge status={pandal.verificationStatus} t={t} />
          {pandal.isDemo ? <DemoBadge t={t} /> : null}
        </div>
      </div>

      <ThemeLine pandal={pandal} t={t} lang={lang} className="mt-3" />

      {pandal.distanceM != null ? (
        <p className="text-muted-foreground mt-1 text-sm" data-testid="distance">
          {fmt(t.explore.away, { distance: formatDistance(pandal.distanceM, lang) })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          className="btn btn-primary btn-sm"
          href={navigateUrl(pandal)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.pandal.navigate}: ${displayName}`}
          data-testid="navigate-link"
        >
          <Navigation className="size-4" aria-hidden />
          {t.pandal.navigate}
        </a>
      </div>
      <div className="mt-2">
        <PandalActions slug={pandal.slug} name={displayName} compact />
      </div>
    </article>
  );
}
