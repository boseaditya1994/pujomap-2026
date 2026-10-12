import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/states";
import { getDictionary, isLocale } from "@/lib/i18n";

async function Missing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "en";
  const t = getDictionary(locale);
  return (
    <EmptyState title={t.common.notFoundTitle} body={t.common.notFoundBody}>
      <Link href={`/${locale}`} className="btn btn-primary">
        {t.common.backHome}
      </Link>
    </EmptyState>
  );
}

/** Any unknown path under a locale lands here, so visitors get a page in their language. */
export default function CatchAllPage({ params }: PageProps<"/[lang]/[...rest]">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10" data-testid="not-found">
      <Suspense fallback={null}>
        <Missing params={params} />
      </Suspense>
    </div>
  );
}
