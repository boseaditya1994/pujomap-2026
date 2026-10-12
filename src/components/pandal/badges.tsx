import { BadgeCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { getThemeDisplay } from "@/lib/domain/pandal";
import type { Pandal, VerificationStatus } from "@/lib/domain/types";
import { fmt, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";

/** Status is carried by icon and text, never by colour alone. */
export function VerificationBadge({ status, t }: { status: VerificationStatus; t: Dictionary }) {
  if (status === "verified") {
    return (
      <span data-testid="badge-verified" className={cn(pill, "bg-verified-soft text-verified")}>
        <BadgeCheck className="size-3.5" aria-hidden />
        {t.pandal.verified}
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span data-testid="badge-needs-review" className={cn(pill, "bg-caution-soft text-caution")}>
        <TriangleAlert className="size-3.5" aria-hidden />
        {t.pandal.needsReview}
      </span>
    );
  }
  return (
    <span data-testid="badge-unverified" className={cn(pill, "bg-muted text-muted-foreground")}>
      <CircleHelp className="size-3.5" aria-hidden />
      {t.pandal.unverified}
    </span>
  );
}

export function DemoBadge({ t }: { t: Dictionary }) {
  return <span className={cn(pill, "border-input text-muted-foreground border border-dashed")}>{t.demo.badge}</span>;
}

type ThemeFields = Pick<Pandal, "themeTitle" | "themeYear" | "themeStatus" | "themeSource">;

/** One-line theme summary that always says how much the theme can be trusted. */
export function ThemeLine({
  pandal,
  t,
  lang,
  className,
}: {
  pandal: ThemeFields;
  t: Dictionary;
  lang: Locale;
  className?: string;
}) {
  const theme = getThemeDisplay(pandal);
  const year = (y: number) => formatNumber(y, lang).replace(/[,٬]/g, "");
  if (theme.kind === "unknown") {
    return <p className={cn("text-muted-foreground text-sm", className)}>{t.pandal.themeUnknown}</p>;
  }
  const label =
    theme.kind === "confirmed"
      ? fmt(t.pandal.themeConfirmed, { year: year(theme.year) })
      : theme.kind === "unconfirmed"
        ? fmt(t.pandal.themeUnconfirmed, { year: year(theme.year) })
        : fmt(t.pandal.themeHistorical, { year: year(theme.year) });
  return (
    <p className={cn("text-sm", className)} data-theme-kind={theme.kind}>
      <span className={cn("font-semibold", theme.kind === "confirmed" ? "text-foreground" : "text-muted-foreground")}>
        {theme.title}
      </span>
      <span className="text-muted-foreground"> · {label}</span>
    </p>
  );
}
