import { ArrowRight, BadgeCheck, CircleHelp, ScrollText, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteCard } from "@/components/routes/route-card";
import { Alpona } from "@/components/states";
import { getCuratedRoutes, getPandals } from "@/lib/data/queries";
import { REGIONS } from "@/lib/domain/types";
import { formatNumber, getDictionary, isLocale } from "@/lib/i18n";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [pandals, routes] = await Promise.all([getPandals(), getCuratedRoutes()]);

  const verified = pandals.filter((p) => p.verificationStatus === "verified").length;
  const regionCounts = REGIONS.map((r) => ({ region: r, count: pandals.filter((p) => p.region === r).length })).filter(
    (r) => r.count > 0 || r.region !== "other",
  );
  const stats = [
    { label: t.home.statsPandals, value: pandals.length },
    { label: t.home.statsVerified, value: verified },
    { label: t.home.statsRegions, value: new Set(pandals.map((p) => p.region)).size },
  ];

  return (
    <>
      <section className="bg-primary text-primary-foreground relative overflow-hidden">
        <Alpona className="text-gold-soft/25 pointer-events-none absolute -top-24 -right-24 size-[26rem]" />
        <Alpona className="text-gold-soft/15 pointer-events-none absolute -bottom-40 -left-32 size-[22rem]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:py-20">
          <p className="text-gold-soft text-sm font-semibold tracking-[0.2em] uppercase">{t.meta.tagline}</p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-tight sm:text-6xl">{t.home.heroTitle}</h1>
          <p className="text-primary-foreground/90 mt-4 max-w-xl text-base sm:text-lg">{t.home.heroBody}</p>

          <form action={`/${lang}/explore`} role="search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <label htmlFor="home-search" className="sr-only">
              {t.explore.searchLabel}
            </label>
            <div className="relative flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                aria-hidden
              />
              <input
                id="home-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder={t.home.searchPlaceholder}
                className="field h-12 border-transparent pl-10"
              />
            </div>
            <button type="submit" className="btn btn-accent h-12 px-6 text-base">
              {t.home.searchButton}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/${lang}/explore`}
              className="btn border-gold-soft/60 text-primary-foreground hover:bg-white/10"
            >
              {t.home.ctaExplore}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={`/${lang}/plan`} className="btn border-gold-soft/60 text-primary-foreground hover:bg-white/10">
              {t.home.ctaPlan}
            </Link>
          </div>
        </div>
        <div className="gold-rule" aria-hidden />
      </section>

      <section aria-label={t.home.statsPandals} className="bg-card border-b">
        <dl className="mx-auto grid max-w-5xl grid-cols-3 divide-x px-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse py-5 text-center">
              <dt className="text-muted-foreground text-xs font-medium sm:text-sm">{s.label}</dt>
              <dd className="font-heading text-maroon text-3xl sm:text-4xl">{formatNumber(s.value, lang)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12">
        <section aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="text-2xl sm:text-3xl">
            {t.home.browseRegions}
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {regionCounts.map(({ region, count }) => (
              <li key={region}>
                <Link
                  href={`/${lang}/explore?region=${region}`}
                  className="bg-card hover:border-vermilion hover:bg-accent flex min-h-20 flex-col justify-between rounded-2xl border p-4 transition-colors"
                >
                  <span className="font-heading text-lg leading-tight">{t.regions[region]}</span>
                  <span className="text-muted-foreground text-sm">
                    {count === 1
                      ? t.explore.resultsOne
                      : t.explore.results.replace("{count}", formatNumber(count, lang))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="curated-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="curated-heading" className="text-2xl sm:text-3xl">
                {t.home.curatedTitle}
              </h2>
              <p className="text-muted-foreground mt-1 max-w-xl">{t.home.curatedBody}</p>
            </div>
            <Link href={`/${lang}/routes`} className="btn btn-outline">
              {t.home.seeAllRoutes}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.slice(0, 3).map((route) => (
              <li key={route.id}>
                <RouteCard route={route} pandals={pandals} lang={lang} t={t} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="trust-heading" className="bg-card rounded-3xl border p-6 sm:p-8">
          <h2 id="trust-heading" className="text-2xl sm:text-3xl">
            {t.home.trustTitle}
          </h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-3">
            {[
              { icon: BadgeCheck, text: t.home.trustVerified },
              { icon: ScrollText, text: t.home.trustTheme },
              { icon: CircleHelp, text: t.home.trustUnknown },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon className="text-vermilion mt-0.5 size-6 shrink-0" aria-hidden />
                <p className="text-sm leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
