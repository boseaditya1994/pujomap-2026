import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";

export const metadata = { title: "Audit log" };

const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AuditPage() {
  await requireAdminPage();
  const entries = await (await getAdminRepository()).listAudit(200);
  return (
    <>
      <h1 className="text-3xl">Audit log</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The 200 most recent administrative changes. Times are India Standard Time.
      </p>
      <div className="bg-card mt-4 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[560px] text-left text-sm" data-testid="audit-table">
          <thead className="bg-muted border-b text-xs tracking-wide uppercase">
            <tr>
              <th scope="col" className="px-3 py-2">
                When
              </th>
              <th scope="col" className="px-3 py-2">
                Who
              </th>
              <th scope="col" className="px-3 py-2">
                Action
              </th>
              <th scope="col" className="px-3 py-2">
                What
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap">{stamp.format(new Date(e.createdAt))}</td>
                <td className="px-3 py-2">{e.actor}</td>
                <td className="px-3 py-2">
                  {e.action} {e.entityType.replace("_", " ")}
                </td>
                <td className="px-3 py-2">{e.summary}</td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-3 py-6 text-center">
                  No changes recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
