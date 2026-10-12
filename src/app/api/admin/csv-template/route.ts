import { NotAuthorizedError, requireAdmin } from "@/lib/auth/admin";
import { CSV_COLUMNS } from "@/lib/domain/csv";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthorizedError) return new Response("Not authorised", { status: 401 });
    throw err;
  }
  return new Response(`${CSV_COLUMNS.join(",")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pandals.template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
