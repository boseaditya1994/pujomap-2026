"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

type I18n = { lang: Locale; t: Dictionary };
const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ lang, t, children }: I18n & { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ lang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
