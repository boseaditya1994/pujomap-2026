"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { saveCuratedRoute, type FormState } from "@/app/(admin)/admin/actions";
import { submitKeepingValues } from "@/lib/client/forms";
import { Notice } from "@/components/states";
import { MAX_STOPS } from "@/lib/domain/route-plan";
import { REGIONS, TRAVEL_MODES, type CuratedRoute } from "@/lib/domain/types";

type Option = { id: string; name: string; region: string; verified: boolean };

export function RouteForm({ route, pandals }: { route: CuratedRoute | null; pandals: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCuratedRoute.bind(null, route?.id ?? null), {
    ok: true,
  });
  const e = state.fieldErrors ?? {};
  const sent = state.values;
  const v = (name: string, saved: string | null | undefined) => (sent ? (sent[name] ?? "") : (saved ?? ""));
  const [stops, setStops] = useState<string[]>(route?.stopPandalIds ?? []);
  const [pick, setPick] = useState("");
  const byId = new Map(pandals.map((p) => [p.id, p]));
  const available = pandals.filter((p) => !stops.includes(p.id));

  const move = (i: number, d: -1 | 1) => {
    const next = [...stops];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setStops(next);
  };

  const input = (
    name: string,
    label: string,
    value: string | null | undefined,
    opts: { required?: boolean; hint?: string } = {},
  ) => (
    <div>
      <label htmlFor={`r-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`r-${name}`}
        name={name}
        defaultValue={v(name, value)}
        required={opts.required}
        className="field"
        aria-invalid={e[name] ? true : undefined}
      />
      {e[name] ? (
        <p className="field-error">{e[name]}</p>
      ) : opts.hint ? (
        <p className="field-hint">{opts.hint}</p>
      ) : null}
    </div>
  );

  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="mt-6 space-y-6" data-testid="route-form">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <fieldset className="bg-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold">Route</legend>
        {input("title", "Title", route?.title, { required: true })}
        {input("titleBn", "Title (Bengali)", route?.titleBn)}
        {input("slug", "Slug", route?.slug, {
          hint: "Leave blank to derive it from the title.",
        })}
        <div>
          <label htmlFor="r-region" className="field-label">
            Area
          </label>
          <select id="r-region" name="region" defaultValue={v("region", route?.region ?? "north")} className="field">
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
        {input("description", "Description", route?.description)}
        {input("descriptionBn", "Description (Bengali)", route?.descriptionBn)}
        {input("startLabel", "Start place", route?.startLabel, {
          hint: "A place name Google Maps can find, such as a Metro station. Do not enter coordinates.",
        })}
        <div>
          <label htmlFor="r-mode" className="field-label">
            Suggested travel mode
          </label>
          <select
            id="r-mode"
            name="travelMode"
            defaultValue={v("travelMode", route?.travelMode ?? "walk")}
            className="field"
          >
            {TRAVEL_MODES.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="bg-card rounded-2xl border p-4">
        <legend className="px-1 text-lg font-semibold">
          Stops ({stops.length}/{MAX_STOPS})
        </legend>
        <input type="hidden" name="stops" value={JSON.stringify(stops)} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="r-pick" className="field-label">
              Add a pandal
            </label>
            <select id="r-pick" className="field" value={pick} onChange={(ev) => setPick(ev.target.value)}>
              <option value="">Choose…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.region}){p.verified ? "" : " — not verified"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!pick || stops.length >= MAX_STOPS}
            onClick={() => {
              setStops([...stops, pick]);
              setPick("");
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add stop
          </button>
        </div>
        {e.stopPandalIds ? <p className="field-error">{e.stopPandalIds}</p> : null}
        <ol className="mt-4 space-y-2">
          {stops.map((id, i) => {
            const name = byId.get(id)?.name ?? "Unknown pandal";
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border p-2">
                <span className="w-6 text-center text-sm font-bold">{i + 1}</span>
                <span className="flex-1 text-sm font-medium">{name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm px-2"
                  disabled={i === 0}
                  aria-label={`Move ${name} earlier`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm px-2"
                  disabled={i === stops.length - 1}
                  aria-label={`Move ${name} later`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-destructive px-2"
                  aria-label={`Remove ${name}`}
                  onClick={() => setStops(stops.filter((s) => s !== id))}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={sent ? sent.published === "on" : (route?.published ?? true)}
          className="size-5 accent-[var(--maroon)]"
        />
        <span className="text-sm font-medium">Published (visible to visitors)</span>
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : route ? "Save route" : "Create route"}
      </button>
    </form>
  );
}
