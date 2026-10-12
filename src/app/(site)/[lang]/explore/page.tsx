import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExploreClient } from "@/components/explore/explore-client";
import { PageSkeleton } from "@/components/states";
import { getPandals } from "@/lib/data/queries";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/explore">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").explore.title };
}

export default async function ExplorePage({ params }: PageProps<"/[lang]/explore">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const pandals = await getPandals();
  return (
    // Fills the viewport below the header so the map and list scroll independently.
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[32rem] flex-col md:h-[calc(100dvh-4rem)]" data-explore>
      <Suspense fallback={<PageSkeleton label={t.common.loading} />}>
        <ExploreClient pandals={pandals} />
      </Suspense>
    </div>
  );
}
