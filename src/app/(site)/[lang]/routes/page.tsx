import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteCard } from "@/components/routes/route-card";
import { EmptyState } from "@/components/states";
import { getCuratedRoutes, getPandals } from "@/lib/data/queries";
import { REGIONS } from "@/lib/domain/types";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/routes">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").routes.title };
}

export default async function RoutesPage({ params }: PageProps<"/[lang]/routes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [routes, pandals] = await Promise.all([getCuratedRoutes(), getPandals()]);
  const ordered = [...routes].sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl">{t.routes.title}</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">{t.routes.intro}</p>
      {ordered.length === 0 ? (
        <EmptyState className="mt-6" title={t.routes.emptyTitle} body={t.routes.emptyBody} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((route) => (
            <li key={route.id}>
              <RouteCard route={route} pandals={pandals} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
