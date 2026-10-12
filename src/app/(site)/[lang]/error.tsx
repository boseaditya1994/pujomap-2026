"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";
import { EmptyState } from "@/components/states";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10" role="alert">
      <EmptyState title={t.common.errorTitle} body={t.common.errorBody}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          {t.common.retry}
        </button>
      </EmptyState>
    </div>
  );
}
