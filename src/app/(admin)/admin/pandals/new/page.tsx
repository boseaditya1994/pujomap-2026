import { PandalForm } from "@/components/admin/pandal-form";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Add pandal" };

export default async function NewPandalPage() {
  await requireAdminPage();
  return (
    <>
      <h1 className="text-3xl">Add pandal</h1>
      <PandalForm pandal={null} />
    </>
  );
}
