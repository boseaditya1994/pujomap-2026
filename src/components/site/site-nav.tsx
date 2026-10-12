"use client";

import { Bookmark, Compass, Languages, Route, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Alpona } from "@/components/states";
import { cn } from "@/lib/utils";

function useNavItems() {
  const { t, lang } = useI18n();
  return [
    { href: `/${lang}/explore`, label: t.nav.explore, icon: Compass },
    { href: `/${lang}/routes`, label: t.nav.routes, icon: Waypoints },
    { href: `/${lang}/plan`, label: t.nav.plan, icon: Route },
    { href: `/${lang}/saved`, label: t.nav.saved, icon: Bookmark },
  ];
}

function LanguageLink() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const other = lang === "en" ? "bn" : "en";
  const target = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
  return (
    <a
      href={target}
      hrefLang={other}
      lang={other}
      aria-label={t.nav.switchLanguageLabel}
      data-testid="language-switch"
      className="text-primary-foreground inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-white/10"
      // Carry the current filters / plan across, which usePathname alone would drop.
      onClick={(e) => {
        e.preventDefault();
        window.location.assign(target + window.location.search);
      }}
    >
      <Languages className="size-4" aria-hidden />
      {t.nav.switchLanguage}
    </a>
  );
}

export function SiteHeader() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-40">
      <a
        href="#main"
        className="focus:bg-card focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2"
      >
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-4">
        <Link href={`/${lang}`} className="flex min-h-11 items-center gap-2 rounded-lg pr-2">
          <Alpona className="text-gold-soft size-8" />
          <span className="font-heading text-xl leading-none">{t.meta.title}</span>
        </Link>
        <nav aria-label={t.nav.primary} className="ml-4 hidden md:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-white/10",
                      active && "decoration-gold-soft bg-white/15 underline decoration-2 underline-offset-8",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center">
          <LanguageLink />
        </div>
      </div>
      <div className="gold-rule" aria-hidden />
    </header>
  );
}

/** Thumb-reach tab bar for small screens. */
export function MobileTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <nav
      aria-label={t.nav.primary}
      className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                  active ? "text-vermilion" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
