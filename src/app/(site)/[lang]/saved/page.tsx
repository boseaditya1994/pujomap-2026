import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedClient } from "@/components/saved/saved-client";
import { getPandals } from "@/lib/data/queries";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/saved">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").saved.title };
}

export default async function SavedPage({ params }: PageProps<"/[lang]/saved">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <SavedClient pandals={await getPandals()} />;
}
