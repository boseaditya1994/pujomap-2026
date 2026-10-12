import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlannerClient } from "@/components/plan/planner-client";
import { PageSkeleton } from "@/components/states";
import { getPandals } from "@/lib/data/queries";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/plan">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").plan.title };
}

export default async function PlanPage({ params }: PageProps<"/[lang]/plan">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const pandals = await getPandals();
  return (
    <Suspense fallback={<PageSkeleton label={getDictionary(lang).common.loading} />}>
      <PlannerClient pandals={pandals} />
    </Suspense>
  );
}
