import Link from "next/link";
import { Notice } from "@/components/states";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";

export const metadata = { title: "Curated routes" };

export default async function AdminRoutesPage({ searchParams }: PageProps<"/admin/routes">) {
  await requireAdminPage();
  const sp = await searchParams;
  const routes = await (await getAdminRepository()).listAllCuratedRoutes();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Curated routes</h1>
        <Link href="/admin/routes/new" className="btn btn-primary">
          Add route
        </Link>
      </div>
      {sp.saved ? (
        <Notice tone="success" className="mt-4">
          Route saved.
        </Notice>
      ) : null}
      {sp.deleted ? (
        <Notice tone="success" className="mt-4">
          Route deleted.
        </Notice>
      ) : null}
      <ul className="bg-card mt-6 divide-y rounded-2xl border" data-testid="admin-route-list">
        {routes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/routes/${r.id}`}
              className="hover:bg-accent flex items-center justify-between gap-3 px-4 py-3"
            >
              <span>
                <span className="block font-semibold">{r.title}</span>
                <span className="text-muted-foreground text-sm">
                  {r.region} · {r.stopPandalIds.length} stops · {r.travelMode.replace("_", " ")}
                </span>
              </span>
              <span className="text-muted-foreground text-sm">{r.published ? "Published" : "Hidden"}</span>
            </Link>
          </li>
        ))}
        {routes.length === 0 ? <li className="text-muted-foreground px-4 py-6 text-center">No routes yet.</li> : null}
      </ul>
    </>
  );
}
