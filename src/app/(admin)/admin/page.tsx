import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";

export default async function AdminHomePage() {
  await requireAdminPage();
  const repo = await getAdminRepository();
  const [pandals, routes, pending] = await Promise.all([
    repo.listAllPandals(),
    repo.listAllCuratedRoutes(),
    repo.listSubmissions("pending"),
  ]);
  const count = (fn: (p: (typeof pandals)[number]) => boolean) => pandals.filter(fn).length;
  const cards = [
    { label: "Pandals", value: pandals.length, href: "/admin/pandals" },
    {
      label: "Verified",
      value: count((p) => p.verificationStatus === "verified"),
      href: "/admin/pandals?status=verified",
    },
    {
      label: "Needs review",
      value: count((p) => p.verificationStatus === "needs_review"),
      href: "/admin/pandals?status=needs_review",
    },
    {
      label: "Unverified",
      value: count((p) => p.verificationStatus === "unverified"),
      href: "/admin/pandals?status=unverified",
    },
    { label: "Confirmed 2026 themes", value: count((p) => p.themeStatus === "confirmed"), href: "/admin/pandals" },
    { label: "Curated routes", value: routes.length, href: "/admin/routes" },
    { label: "Pending submissions", value: pending.length, href: "/admin/submissions" },
  ];
  return (
    <>
      <h1 className="text-3xl">Overview</h1>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="bg-card hover:border-vermilion block rounded-2xl border p-4">
              <span className="font-heading text-maroon block text-3xl">{c.value}</span>
              <span className="text-muted-foreground text-sm">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
