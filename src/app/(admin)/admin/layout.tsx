import type { Metadata } from "next";
import { Hind_Siliguri, Tiro_Bangla } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth/admin";
import { FESTIVAL_YEAR } from "@/lib/domain/types";
import { dataMode } from "@/lib/env";
import { signOut } from "./actions";
import "../../globals.css";

const body = Hind_Siliguri({ subsets: ["latin", "bengali"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Tiro_Bangla({ subsets: ["latin", "bengali"], weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: `Admin · PujoMap ${FESTIVAL_YEAR}`, template: "%s · PujoMap admin" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pandals", label: "Pandals" },
  { href: "/admin/import", label: "CSV import" },
  { href: "/admin/routes", label: "Curated routes" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/audit", label: "Audit log" },
];

async function AdminNav() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <nav aria-label="Admin" className="bg-card border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2">
        <ul className="flex flex-wrap gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="btn btn-ghost btn-sm">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={signOut} className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{admin.email}</span>
          <button type="submit" className="btn btn-outline btn-sm">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <header className="bg-primary text-primary-foreground">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/admin" className="font-heading text-xl">
              PujoMap admin
            </Link>
            <Link href="/en" className="text-sm underline underline-offset-4">
              View site
            </Link>
          </div>
          <div className="gold-rule" aria-hidden />
        </header>
        {dataMode() === "local" ? (
          <p role="note" className="bg-caution-soft text-caution px-4 py-2 text-center text-sm font-medium">
            Local development mode: data is sample data held in memory and resets when the server restarts.
          </p>
        ) : null}
        {/* Admin pages read the session cookie, so they render at request time inside this boundary. */}
        <Suspense fallback={<p className="text-muted-foreground p-6 text-sm">Loading…</p>}>
          <AdminNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </Suspense>
      </body>
    </html>
  );
}
