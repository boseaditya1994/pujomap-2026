import { FESTIVAL_YEAR } from "@/lib/domain/types";
import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** Fills {festivalYear} throughout a dictionary, in the locale's own digits. */
function withFestivalYear<T>(value: T, year: string): T {
  if (typeof value === "string") return value.replaceAll("{festivalYear}", year) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withFestivalYear(v, year)])) as T;
  }
  return value;
}

const yearIn = (locale: Locale) =>
  new Intl.NumberFormat(locale === "bn" ? "bn-IN" : "en-IN", { useGrouping: false }).format(FESTIVAL_YEAR);

const dictionaries: Record<Locale, Dictionary> = {
  en: withFestivalYear(en, yearIn("en")),
  bn: withFestivalYear(bn, yearIn("bn")),
};
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
