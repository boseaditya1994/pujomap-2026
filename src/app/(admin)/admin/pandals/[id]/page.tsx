import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PandalForm } from "@/components/admin/pandal-form";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";
import { deletePandal } from "../../actions";

export const metadata = { title: "Edit pandal" };

export default async function EditPandalPage({ params }: PageProps<"/admin/pandals/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  const pandal = await (await getAdminRepository()).getPandal(id);
  if (!pandal) notFound();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Edit: {pandal.name}</h1>
        {pandal.published ? (
          <Link href={`/en/pandals/${pandal.slug}`} className="btn btn-outline btn-sm">
            View public page
          </Link>
        ) : null}
      </div>
      <PandalForm pandal={pandal} />
      <form action={deletePandal} className="border-destructive/40 mt-10 rounded-2xl border p-4">
        <input type="hidden" name="id" value={pandal.id} />
        <h2 className="text-lg font-semibold">Delete this pandal</h2>
        <p className="field-hint">This removes it from the map and from any curated routes. It cannot be undone.</p>
        <ConfirmSubmit className="btn btn-danger mt-3" question={`Delete "${pandal.name}" permanently?`}>
          Delete pandal
        </ConfirmSubmit>
      </form>
    </>
  );
}
