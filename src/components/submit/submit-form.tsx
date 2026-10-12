"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { submitSuggestion, type SubmitState } from "@/app/(site)/[lang]/submit/actions";
import { useI18n } from "@/components/i18n-provider";
import { submitKeepingValues } from "@/lib/client/forms";
import { EmptyState, Notice } from "@/components/states";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/domain/types";

type Option = { slug: string; name: string };

export function SubmitForm({ pandals }: { pandals: Option[] }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitSuggestion, { status: "idle" });
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<SubmitState | null>(null);

  const presetType = SUBMISSION_TYPES.includes(params.get("type") as SubmissionType)
    ? (params.get("type") as SubmissionType)
    : "new_pandal";
  const presetPandal = pandals.some((p) => p.slug === params.get("pandal")) ? (params.get("pandal") as string) : "";
  const [type, setType] = useState<SubmissionType>(presetType);
  const [pandal, setPandal] = useState(presetPandal);

  const sent = (field: string) => (state.status === "error" ? (state.values[field] ?? "") : "");
  const invalid = (field: string) => state.status === "error" && state.fields.includes(field);
  const optional = <span className="text-muted-foreground font-normal"> ({t.common.optional})</span>;

  if (state.status === "success" && dismissed !== state) {
    return (
      <EmptyState title={t.submit.successTitle} body={t.submit.successBody} className="mt-6">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setDismissed(state);
            setFormKey((k) => k + 1);
          }}
        >
          {t.submit.another}
        </button>
      </EmptyState>
    );
  }

  return (
    <form
      key={formKey}
      action={action}
      onSubmit={submitKeepingValues(action)}
      className="mt-6 space-y-5"
      noValidate
      data-testid="submit-form"
    >
      {state.status === "error" ? (
        <Notice tone="error">{state.reason === "invalid" ? t.submit.errorInvalid : t.submit.errorGeneric}</Notice>
      ) : null}

      <div>
        <label htmlFor="sub-type" className="field-label">
          {t.submit.type}
        </label>
        <select
          id="sub-type"
          name="type"
          className="field"
          value={type}
          onChange={(e) => setType(e.target.value as SubmissionType)}
        >
          {SUBMISSION_TYPES.map((v) => (
            <option key={v} value={v}>
              {t.submit.types[v]}
            </option>
          ))}
        </select>
      </div>

      {type !== "new_pandal" ? (
        <div>
          <label htmlFor="sub-pandal" className="field-label">
            {t.submit.existing}
          </label>
          <select
            id="sub-pandal"
            name="pandal"
            className="field"
            value={pandal}
            onChange={(e) => setPandal(e.target.value)}
          >
            <option value="">{t.submit.existingNone}</option>
            {pandals.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "new_pandal" || !pandal ? (
        <div>
          <label htmlFor="sub-name" className="field-label">
            {t.submit.pandalName}
          </label>
          <input
            id="sub-name"
            name="pandalName"
            defaultValue={sent("pandalName")}
            className="field"
            required
            maxLength={200}
            aria-invalid={invalid("pandalName") || undefined}
            aria-describedby={invalid("pandalName") ? "sub-name-error" : undefined}
          />
          {invalid("pandalName") ? (
            <p id="sub-name-error" className="field-error">
              {t.submit.errorInvalid}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="sub-details" className="field-label">
          {t.submit.details}
        </label>
        <textarea
          id="sub-details"
          name="details"
          defaultValue={sent("details")}
          className="field min-h-32"
          required
          maxLength={3000}
          aria-invalid={invalid("details") || undefined}
          aria-describedby="sub-details-hint"
        />
        <p id="sub-details-hint" className={invalid("details") ? "field-error" : "field-hint"}>
          {t.submit.detailsHint}
        </p>
      </div>

      <div>
        <label htmlFor="sub-source" className="field-label">
          {t.submit.sourceUrl}
          {optional}
        </label>
        <input
          id="sub-source"
          name="sourceUrl"
          defaultValue={sent("sourceUrl")}
          type="url"
          inputMode="url"
          className="field"
          placeholder="https://"
          aria-invalid={invalid("sourceUrl") || undefined}
          aria-describedby="sub-source-hint"
        />
        <p id="sub-source-hint" className={invalid("sourceUrl") ? "field-error" : "field-hint"}>
          {t.submit.sourceHint}
        </p>
      </div>

      {type === "new_pandal" || type === "location_report" ? (
        <fieldset>
          <legend className="field-label">
            {t.submit.coords}
            {optional}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sub-lat" className="sr-only">
                {t.submit.lat}
              </label>
              <input
                id="sub-lat"
                name="lat"
                defaultValue={sent("lat")}
                inputMode="decimal"
                className="field"
                placeholder={t.submit.lat}
                aria-invalid={invalid("lat") || undefined}
              />
            </div>
            <div>
              <label htmlFor="sub-lng" className="sr-only">
                {t.submit.lng}
              </label>
              <input
                id="sub-lng"
                name="lng"
                defaultValue={sent("lng")}
                inputMode="decimal"
                className="field"
                placeholder={t.submit.lng}
                aria-invalid={invalid("lng") || undefined}
              />
            </div>
          </div>
          <p className={invalid("lat") || invalid("lng") ? "field-error" : "field-hint"}>{t.submit.coordsHint}</p>
        </fieldset>
      ) : null}

      <div>
        <label htmlFor="sub-email" className="field-label">
          {t.submit.email}
          {optional}
        </label>
        <input
          id="sub-email"
          name="contactEmail"
          defaultValue={sent("contactEmail")}
          type="email"
          autoComplete="email"
          className="field"
          aria-invalid={invalid("contactEmail") || undefined}
          aria-describedby="sub-email-hint"
        />
        <p id="sub-email-hint" className={invalid("contactEmail") ? "field-error" : "field-hint"}>
          {t.submit.emailHint}
        </p>
      </div>

      {/* Honeypot for bots: hidden from sighted users and assistive technology alike. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? t.submit.sending : t.submit.send}
      </button>
    </form>
  );
}
