import { CsvImport } from "@/components/admin/csv-import";
import { requireAdminPage } from "@/lib/auth/admin";
import { CSV_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/domain/csv";
import { FESTIVAL_YEAR } from "@/lib/domain/types";

export const metadata = { title: "CSV import" };

export default async function ImportPage() {
  await requireAdminPage();
  return (
    <>
      <h1 className="text-3xl">CSV import</h1>
      <div className="mt-3 max-w-3xl space-y-2 text-sm">
        <p>
          Start from{" "}
          <a className="underline underline-offset-4" href="/api/admin/csv-template" download>
            the CSV template
          </a>
          . Rows are matched to existing pandals by <code className="bg-muted rounded px-1">slug</code>; a blank slug is
          derived from the name. Up to {MAX_IMPORT_ROWS} rows per file.
        </p>
        <ul className="text-muted-foreground list-inside list-disc">
          <li>Coordinates must be decimal degrees inside Greater Kolkata.</li>
          <li>
            <code className="bg-muted rounded px-1">theme_status=confirmed</code> needs a title, a source and{" "}
            <code className="bg-muted rounded px-1">theme_year={FESTIVAL_YEAR}</code>. Earlier themes are imported as
            history, never as confirmed.
          </li>
          <li>
            <code className="bg-muted rounded px-1">verification_status=verified</code> needs a source and a
            last-verified date (YYYY-MM-DD).
          </li>
          <li>The import is all-or-nothing: one invalid row stops the whole file.</li>
        </ul>
        <p className="text-muted-foreground">Columns: {CSV_COLUMNS.join(", ")}</p>
      </div>
      <CsvImport />
    </>
  );
}
