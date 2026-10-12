import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

const dictionaries: Record<Locale, Dictionary> = { en, bn };
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
export type { Dictionary };

/** Replaces {placeholders} in a dictionary string. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bn" ? "bn-IN" : "en-IN").format(n);
}

export function formatDate(isoDate: string, locale: Locale): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}
