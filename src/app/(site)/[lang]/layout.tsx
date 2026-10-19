import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Tiro_Bangla } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { MobileTabBar, SiteHeader } from "@/components/site/site-nav";
import { dataMode, publicEnv } from "@/lib/env";
import { LOCALES, getDictionary, isLocale } from "@/lib/i18n";
import "../../globals.css";

// Both faces cover Latin and Bengali, so the two languages share one look.
const body = Hind_Siliguri({ subsets: ["latin", "bengali"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Tiro_Bangla({ subsets: ["latin", "bengali"], weight: "400", variable: "--font-display" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDictionary(isLocale(lang) ? lang : "en");
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${t.meta.title} — ${t.meta.tagline}`, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
    applicationName: t.meta.title,
    alternates: { languages: { en: "/en", bn: "/bn" } },
  };
}

export const viewport: Viewport = { themeColor: "#7b1626", width: "device-width", initialScale: 1 };

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const showDemoBanner = dataMode() === "local";

  return (
    <html lang={lang} className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col pb-14 md:pb-0">
        <I18nProvider lang={lang} t={t}>
          {/* The nav highlights the current page from the URL, which is only known per request. */}
          <Suspense fallback={<div className="bg-primary h-[61px]" aria-hidden />}>
            <SiteHeader />
          </Suspense>
          {showDemoBanner ? (
            <p
              role="note"
              data-testid="demo-banner"
              className="bg-caution-soft text-caution px-4 py-2 text-center text-sm font-medium"
            >
              {t.demo.banner}
            </p>
          ) : null}
          <main id="main" className="flex min-h-0 flex-1 flex-col">
            {children}
          </main>
          <footer className="bg-card text-muted-foreground border-t px-4 py-6 text-sm" data-site-footer>
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl">{t.footer.disclaimer}</p>
              <ul className="flex gap-4">
                <li>
                  <Link className="underline underline-offset-4" href={`/${lang}/submit`}>
                    {t.nav.submit}
                  </Link>
                </li>
                <li>
                  <Link className="underline underline-offset-4" href="/admin" prefetch={false}>
                    {t.footer.admin}
                  </Link>
                </li>
              </ul>
            </div>
          </footer>
          <Suspense fallback={null}>
            <MobileTabBar />
          </Suspense>
        </I18nProvider>
      </body>
    </html>
  );
}
