import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { RouteForm } from "@/components/admin/route-form";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";
import { deleteCuratedRoute } from "../../actions";

export const metadata = { title: "Edit route" };

/** `/admin/routes/new` creates a route; any other id edits that route. */
export default async function EditRoutePage({ params }: PageProps<"/admin/routes/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  const repo = await getAdminRepository();
  const [routes, pandals] = await Promise.all([repo.listAllCuratedRoutes(), repo.listAllPandals()]);
  const route = id === "new" ? null : (routes.find((r) => r.id === id) ?? null);
  if (id !== "new" && !route) notFound();

  const options = pandals
    .filter((p) => p.published)
    .map((p) => ({ id: p.id, name: p.name, region: p.region, verified: p.verificationStatus === "verified" }));

  return (
    <>
      <h1 className="text-3xl">{route ? `Edit: ${route.title}` : "Add route"}</h1>
      <RouteForm route={route} pandals={options} />
      {route ? (
        <form action={deleteCuratedRoute} className="border-destructive/40 mt-10 rounded-2xl border p-4">
          <input type="hidden" name="id" value={route.id} />
          <h2 className="text-lg font-semibold">Delete this route</h2>
          <ConfirmSubmit className="btn btn-danger mt-3" question={`Delete the route "${route.title}"?`}>
            Delete route
          </ConfirmSubmit>
        </form>
      ) : null}
    </>
  );
}
