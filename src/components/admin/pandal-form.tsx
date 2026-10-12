"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { savePandal, type FormState } from "@/app/(admin)/admin/actions";
import { submitKeepingValues } from "@/lib/client/forms";
import { Notice } from "@/components/states";
import { placeUrl } from "@/lib/domain/deeplinks";
import {
  FESTIVAL_YEAR,
  GREATER_KOLKATA_BOUNDS,
  REGIONS,
  THEME_STATUSES,
  VERIFICATION_STATUSES,
  WHEELCHAIR_VALUES,
  type Pandal,
  type PandalImage,
} from "@/lib/domain/types";

type FieldProps = {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  textarea?: boolean;
  onChange?: (value: string) => void;
};

function Field({ name, label, defaultValue, error, hint, required, type = "text", textarea, onChange }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const common = {
    id,
    name,
    required,
    defaultValue: defaultValue ?? "",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: onChange
      ? (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)
      : undefined,
  };
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </label>
      {textarea ? (
        <textarea {...common} className="field min-h-24" />
      ) : (
        <input {...common} type={type} className="field" />
      )}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
  error?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className="field" aria-invalid={error ? true : undefined}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/[_-]/g, " ")}
          </option>
        ))}
      </select>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

const blankImage: PandalImage = {
  url: "",
  alt: "",
  credit: null,
  sourceUrl: null,
};

function ImageFields({ initial, error }: { initial: PandalImage[]; error?: string }) {
  const [images, setImages] = useState<PandalImage[]>(initial);
  const patch = (i: number, next: Partial<PandalImage>) =>
    setImages(images.map((img, j) => (j === i ? { ...img, ...next } : img)));
  return (
    <fieldset className="bg-card rounded-2xl border p-4">
      <legend className="px-1 text-lg font-semibold">Photos</legend>
      <p className="field-hint mt-0">
        Add photos by HTTPS address. Only use images you have the right to publish, and credit the photographer.
      </p>
      <input type="hidden" name="images" value={JSON.stringify(images.filter((img) => img.url.trim()))} />
      <ul className="mt-3 space-y-3">
        {images.map((img, i) => (
          <li key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor={`img-url-${i}`}>
                Image URL {i + 1}
              </label>
              <input
                id={`img-url-${i}`}
                className="field"
                type="url"
                value={img.url}
                onChange={(e) => patch(i, { url: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`img-alt-${i}`}>
                Description (alt text)
              </label>
              <input
                id={`img-alt-${i}`}
                className="field"
                value={img.alt}
                onChange={(e) => patch(i, { alt: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`img-credit-${i}`}>
                Credit
              </label>
              <input
                id={`img-credit-${i}`}
                className="field"
                value={img.credit ?? ""}
                onChange={(e) => patch(i, { credit: e.target.value || null })}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-destructive justify-self-start"
              onClick={() => setImages(images.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
              Remove photo {i + 1}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="field-error">{error}</p> : null}
      <button
        type="button"
        className="btn btn-outline btn-sm mt-3"
        disabled={images.length >= 12}
        onClick={() => setImages([...images, blankImage])}
      >
        <Plus className="size-4" aria-hidden />
        Add photo
      </button>
    </fieldset>
  );
}

export function PandalForm({ pandal }: { pandal: Pandal | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePandal.bind(null, pandal?.id ?? null), {
    ok: true,
  });
  const e = state.fieldErrors ?? {};
  // After a rejected save the browser resets the form, so fall back to what was just submitted.
  const sent = state.values;
  const v = (name: string, saved: string | number | null | undefined) => (sent ? (sent[name] ?? "") : (saved ?? ""));
  const [lat, setLat] = useState(pandal ? String(pandal.lat) : "");
  const [lng, setLng] = useState(pandal ? String(pandal.lng) : "");
  const [address, setAddress] = useState(pandal?.address ?? "");

  const pin = { lat: Number(lat), lng: Number(lng) };
  const b = GREATER_KOLKATA_BOUNDS;
  const pinValid =
    lat !== "" && lng !== "" && pin.lat >= b.south && pin.lat <= b.north && pin.lng >= b.west && pin.lng <= b.east;

  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="mt-6 space-y-6" data-testid="pandal-form">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}

      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Identity</legend>
        <Field name="name" label="Name" required defaultValue={v("name", pandal?.name)} error={e.name} />
        <Field name="nameBn" label="Name (Bengali)" defaultValue={v("nameBn", pandal?.nameBn)} error={e.nameBn} />
        <Field
          name="slug"
          label="Slug"
          defaultValue={v("slug", pandal?.slug)}
          error={e.slug}
          hint="Leave blank to derive it from the name. Changing it breaks existing links and saved favourites."
        />
        <Field
          name="committee"
          label="Organising committee"
          defaultValue={v("committee", pandal?.committee)}
          error={e.committee}
        />
        <div className="sm:col-span-2">
          <Field
            name="description"
            label="Description"
            textarea
            defaultValue={v("description", pandal?.description)}
            error={e.description}
          />
        </div>
      </fieldset>

      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Location and pin check</legend>
        <div className="sm:col-span-2">
          <Field
            name="address"
            label="Address"
            required
            defaultValue={v("address", pandal?.address)}
            error={e.address}
            onChange={setAddress}
          />
        </div>
        <Field
          name="lat"
          label="Latitude"
          required
          defaultValue={v("lat", pandal?.lat)}
          error={e.lat}
          hint={`Between ${b.south} and ${b.north}`}
          onChange={setLat}
        />
        <Field
          name="lng"
          label="Longitude"
          required
          defaultValue={v("lng", pandal?.lng)}
          error={e.lng}
          hint={`Between ${b.west} and ${b.east}`}
          onChange={setLng}
        />
        <Field
          name="neighbourhood"
          label="Neighbourhood"
          required
          defaultValue={v("neighbourhood", pandal?.neighbourhood)}
          error={e.neighbourhood}
        />
        <Select
          name="region"
          label="Area"
          options={REGIONS}
          defaultValue={String(v("region", pandal?.region ?? "central"))}
          error={e.region}
        />
        <Field
          name="nearestMetro"
          label="Nearest Metro station"
          defaultValue={v("nearestMetro", pandal?.nearestMetro)}
          error={e.nearestMetro}
          hint="Leave blank if not confirmed."
        />
        <Field
          name="openingSchedule"
          label="Opening schedule"
          defaultValue={v("openingSchedule", pandal?.openingSchedule)}
          error={e.openingSchedule}
          hint="Leave blank if not confirmed."
        />
        <div className="border-input rounded-xl border border-dashed p-3 sm:col-span-2" data-testid="pin-check">
          <p className="text-sm font-semibold">Check the pin before marking this pandal verified</p>
          <p className="field-hint">
            Open both links and confirm the pin sits on the pandal site, not just the right street. Record how you
            checked under Verification below.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pinValid ? (
              <a className="btn btn-outline btn-sm" href={placeUrl(pin)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Open these coordinates in Google Maps
              </a>
            ) : (
              <span className="text-muted-foreground text-sm">
                Enter coordinates inside Greater Kolkata to check the pin.
              </span>
            )}
            {address.trim().length > 3 ? (
              <a
                className="btn btn-outline btn-sm"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" aria-hidden />
                Search this address in Google Maps
              </a>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Theme</legend>
        <p className="field-hint mt-0 sm:col-span-2">
          Only a {FESTIVAL_YEAR} theme with a source can be marked confirmed. A theme from an earlier year can be
          recorded with its year, but is always shown to visitors as historical.
        </p>
        <Field
          name="themeTitle"
          label="Theme title"
          defaultValue={v("themeTitle", pandal?.themeTitle)}
          error={e.themeTitle}
        />
        <Field
          name="themeYear"
          label="Theme year"
          defaultValue={v("themeYear", pandal?.themeYear)}
          error={e.themeYear}
        />
        <Select
          name="themeStatus"
          label="Theme status"
          options={THEME_STATUSES}
          defaultValue={String(v("themeStatus", pandal?.themeStatus ?? "unknown"))}
          error={e.themeStatus}
        />
        <Field
          name="themeSource"
          label="Theme source"
          defaultValue={v("themeSource", pandal?.themeSource)}
          error={e.themeSource}
          hint="Link or description of where the theme was announced."
        />
      </fieldset>

      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Accessibility</legend>
        <Select
          name="wheelchairAccess"
          label="Step-free access"
          options={WHEELCHAIR_VALUES}
          defaultValue={String(v("wheelchairAccess", pandal?.wheelchairAccess ?? "unknown"))}
          error={e.wheelchairAccess}
        />
        <Field
          name="accessibilityNotes"
          label="Accessibility notes"
          defaultValue={v("accessibilityNotes", pandal?.accessibilityNotes)}
          error={e.accessibilityNotes}
        />
      </fieldset>

      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Verification</legend>
        <Select
          name="verificationStatus"
          label="Verification status"
          options={VERIFICATION_STATUSES}
          defaultValue={String(v("verificationStatus", pandal?.verificationStatus ?? "unverified"))}
          error={e.verificationStatus}
        />
        <Field
          name="lastVerifiedAt"
          label="Last verified date"
          type="date"
          defaultValue={v("lastVerifiedAt", pandal?.lastVerifiedAt)}
          error={e.lastVerifiedAt}
        />
        <div className="sm:col-span-2">
          <Field
            name="verificationSource"
            label="Verification source"
            defaultValue={v("verificationSource", pandal?.verificationSource)}
            error={e.verificationSource}
            hint="For example: committee website link, site visit by a named volunteer, official list."
          />
        </div>
      </fieldset>

      <ImageFields initial={pandal?.images ?? []} error={e.images} />

      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={sent ? sent.published === "on" : (pandal?.published ?? true)}
          className="size-5 accent-[var(--maroon)]"
        />
        <span className="text-sm font-medium">Published (visible to visitors)</span>
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : pandal ? "Save changes" : "Create pandal"}
      </button>
    </form>
  );
}
