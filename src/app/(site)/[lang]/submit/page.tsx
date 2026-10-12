import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/states";
import { SubmitForm } from "@/components/submit/submit-form";
import { getPandals } from "@/lib/data/queries";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/submit">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").submit.title };
}

export default async function SubmitPage({ params }: PageProps<"/[lang]/submit">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const options = (await getPandals()).map((p) => ({
    slug: p.slug,
    name: lang === "bn" && p.nameBn ? p.nameBn : p.name,
  }));
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl">{t.submit.title}</h1>
      <p className="text-muted-foreground mt-2">{t.submit.intro}</p>
      <Suspense fallback={<PageSkeleton label={t.common.loading} />}>
        <SubmitForm pandals={options} />
      </Suspense>
    </div>
  );
}
