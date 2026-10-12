import Link from "next/link";
import { VerificationBadge } from "@/components/pandal/badges";
import { Notice } from "@/components/states";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";
import { getThemeDisplay, matchesQuery } from "@/lib/domain/pandal";
import { VERIFICATION_STATUSES } from "@/lib/domain/types";
import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Pandals" };

export default async function AdminPandalsPage({ searchParams }: PageProps<"/admin/pandals">) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const t = getDictionary("en");

  const all = await (await getAdminRepository()).listAllPandals();
  const rows = all.filter((p) => (!status || p.verificationStatus === status) && matchesQuery(p, q));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Pandals</h1>
        <Link href="/admin/pandals/new" className="btn btn-primary">
          Add pandal
        </Link>
      </div>
      {sp.saved ? (
        <Notice tone="success" className="mt-4">
          Pandal saved.
        </Notice>
      ) : null}
      {sp.deleted ? (
        <Notice tone="success" className="mt-4">
          Pandal deleted.
        </Notice>
      ) : null}

      <form className="mt-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="field-label">
            Search
          </label>
          <input id="q" name="q" type="search" defaultValue={q} className="field" />
        </div>
        <div>
          <label htmlFor="status" className="field-label">
            Verification
          </label>
          <select id="status" name="status" defaultValue={status} className="field">
            <option value="">Any</option>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline">
          Filter
        </button>
      </form>

      <p className="text-muted-foreground mt-4 text-sm">
        {rows.length} of {all.length} pandals
      </p>
      <div className="bg-card mt-2 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="admin-pandal-table">
          <thead className="bg-muted border-b text-xs tracking-wide uppercase">
            <tr>
              <th scope="col" className="px-3 py-2">
                Name
              </th>
              <th scope="col" className="px-3 py-2">
                Area
              </th>
              <th scope="col" className="px-3 py-2">
                Verification
              </th>
              <th scope="col" className="px-3 py-2">
                2026 theme
              </th>
              <th scope="col" className="px-3 py-2">
                Visible
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => {
              const theme = getThemeDisplay(p);
              return (
                <tr key={p.id}>
                  <th scope="row" className="px-3 py-2 font-semibold">
                    <Link href={`/admin/pandals/${p.id}`} className="underline underline-offset-4">
                      {p.name}
                    </Link>
                    {p.isDemo ? <span className="text-muted-foreground ml-2 text-xs font-normal">(sample)</span> : null}
                  </th>
                  <td className="px-3 py-2">
                    {p.neighbourhood}, {t.regions[p.region]}
                  </td>
                  <td className="px-3 py-2">
                    <VerificationBadge status={p.verificationStatus} t={t} />
                  </td>
                  <td className="px-3 py-2">
                    {theme.kind === "confirmed" ? "Confirmed" : theme.kind === "unconfirmed" ? "Unconfirmed" : "—"}
                  </td>
                  <td className="px-3 py-2">{p.published ? "Yes" : "Hidden"}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-3 py-6 text-center">
                  No pandals match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
