"use client";

import { useActionState, useState } from "react";
import { importPandalCsv, type ImportState } from "@/app/(admin)/admin/actions";
import { Notice } from "@/components/states";
import { parsePandalCsv, type CsvImportResult, type CsvRowError } from "@/lib/domain/csv";

function ErrorTable({ errors }: { errors: CsvRowError[] }) {
  return (
    <div className="bg-card mt-3 max-h-96 overflow-auto rounded-xl border">
      <table className="w-full text-left text-sm" data-testid="csv-errors">
        <thead className="bg-muted sticky top-0 border-b text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              Row
            </th>
            <th scope="col" className="px-3 py-2">
              Column
            </th>
            <th scope="col" className="px-3 py-2">
              Problem
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {errors.map((e, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5">{e.row}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{e.field || "—"}</td>
              <td className="px-3 py-1.5">{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CsvImport() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importPandalCsv, { status: "idle" });
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvImportResult | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    // Instant feedback in the browser; the server validates again on import.
    setPreview(parsePandalCsv(text));
  }

  const ready = preview !== null && preview.errors.length === 0 && preview.rows.length > 0;

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="csv-file" className="field-label">
          CSV file
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="field"
          onChange={(e) => onFile(e.target.files?.[0])}
          data-testid="csv-file"
        />
        <input type="hidden" name="csv" value={csv} />
      </div>

      {preview ? (
        preview.errors.length > 0 ? (
          <div>
            <Notice tone="error">
              {fileName}: {preview.errors.length} problem
              {preview.errors.length === 1 ? "" : "s"} found. Nothing will be imported until every row is valid.
            </Notice>
            <ErrorTable errors={preview.errors} />
          </div>
        ) : preview.rows.length === 0 ? (
          <Notice>{fileName} has no data rows.</Notice>
        ) : (
          <Notice tone="success">
            {fileName}: {preview.rows.length} valid row
            {preview.rows.length === 1 ? "" : "s"}. Existing pandals with the same slug will be updated; the rest will
            be created.
          </Notice>
        )
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={!ready || pending} data-testid="csv-import">
        {pending ? "Importing…" : ready ? `Import ${preview.rows.length} rows` : "Import"}
      </button>

      {state.status === "done" ? (
        <Notice tone="success">
          Import complete: {state.created} created, {state.updated} updated.
        </Notice>
      ) : null}
      {state.status === "failed" ? <Notice tone="error">{state.message}</Notice> : null}
      {state.status === "invalid" ? (
        <div>
          <Notice tone="error">The server rejected the file. Nothing was imported.</Notice>
          <ErrorTable errors={state.errors} />
        </div>
      ) : null}
    </form>
  );
}
