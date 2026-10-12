"use client";

import { Check, Heart, ListPlus, Share2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useDraftPlan, useFavourites, useVisited } from "@/lib/client/storage";
import { addStop, MAX_STOPS, removeStop } from "@/lib/domain/route-plan";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = { slug: string; name: string; compact?: boolean; showShare?: boolean };

/** Save / visited / add-to-plan toggles. State lives in the browser only. */
export function PandalActions({ slug, name, compact = false, showShare = false }: Props) {
  const { t } = useI18n();
  const favourites = useFavourites();
  const visited = useVisited();
  const [plan, setPlan] = useDraftPlan();
  const [message, setMessage] = useState<string | null>(null);

  const isFav = favourites.has(slug);
  const isVisited = visited.has(slug);
  const inPlan = plan.stops.includes(slug);
  const size = compact ? "btn-sm" : "";

  function togglePlan() {
    if (inPlan) return setPlan(removeStop(plan, slug));
    const result = addStop(plan, slug);
    if (result.ok) setPlan(result.plan);
    else if (result.reason === "limit") flash(fmt(t.pandal.planFull, { max: MAX_STOPS }));
  }

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 4000);
  }

  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        flash(t.pandal.copied);
      }
    } catch {
      // The visitor dismissed the share sheet, or clipboard access was refused.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={cn("btn btn-outline", size, isFav && "border-vermilion text-vermilion")}
        aria-pressed={isFav}
        aria-label={`${t.pandal.save}: ${name}`}
        data-testid="favourite-toggle"
        onClick={() => favourites.toggle(slug)}
      >
        <Heart className="size-4" aria-hidden fill={isFav ? "currentColor" : "none"} />
        {isFav ? t.pandal.saved : t.pandal.save}
      </button>
      <button
        type="button"
        className={cn("btn btn-outline", size, isVisited && "border-verified text-verified")}
        aria-pressed={isVisited}
        aria-label={`${t.pandal.markVisited}: ${name}`}
        data-testid="visited-toggle"
        onClick={() => visited.toggle(slug)}
      >
        <Check className="size-4" aria-hidden />
        {isVisited ? t.pandal.visited : t.pandal.markVisited}
      </button>
      <button
        type="button"
        className={cn("btn btn-outline", size, inPlan && "border-maroon bg-secondary")}
        aria-pressed={inPlan}
        aria-label={`${t.pandal.addToPlan}: ${name}`}
        data-testid="plan-toggle"
        onClick={togglePlan}
      >
        <ListPlus className="size-4" aria-hidden />
        {inPlan ? t.pandal.inPlan : t.pandal.addToPlan}
      </button>
      {showShare ? (
        <button type="button" className={cn("btn btn-outline", size)} onClick={share}>
          <Share2 className="size-4" aria-hidden />
          {t.pandal.share}
        </button>
      ) : null}
      <span role="status" className="text-muted-foreground text-sm">
        {message}
      </span>
    </div>
  );
}
