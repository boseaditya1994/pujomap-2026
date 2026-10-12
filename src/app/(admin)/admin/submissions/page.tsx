import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminRepository } from "@/lib/data";
import { placeUrl } from "@/lib/domain/deeplinks";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/domain/types";
import { formatDate, getDictionary } from "@/lib/i18n";
import { reviewSubmission } from "../actions";

export const metadata = { title: "Submissions" };

export default async function SubmissionsPage({ searchParams }: PageProps<"/admin/submissions">) {
  await requireAdminPage();
  const sp = await searchParams;
  const status: SubmissionStatus = (SUBMISSION_STATUSES as readonly string[]).includes(String(sp.status))
    ? (sp.status as SubmissionStatus)
    : "pending";
  const t = getDictionary("en");
  const submissions = await (await getAdminRepository()).listSubmissions(status);

  return (
    <>
      <h1 className="text-3xl">Community submissions</h1>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
        Accepting a submission records your decision; it does not change any pandal. Check the claim against a source,
        then make the edit yourself so the verification fields stay accurate.
      </p>
      <ul className="mt-4 flex gap-2">
        {SUBMISSION_STATUSES.map((s) => (
          <li key={s}>
            <Link
              href={`/admin/submissions?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={`btn btn-sm ${s === status ? "btn-primary" : "btn-outline"}`}
            >
              {s}
            </Link>
          </li>
        ))}
      </ul>

      {submissions.length === 0 ? (
        <p className="bg-card text-muted-foreground mt-6 rounded-2xl border border-dashed p-6 text-center">
          No {status} submissions.
        </p>
      ) : (
        <ul className="mt-6 space-y-4" data-testid="submission-list">
          {submissions.map((s) => (
            <li key={s.id} className="bg-card rounded-2xl border p-4">
              <p className="text-vermilion text-xs font-semibold tracking-wide uppercase">{t.submit.types[s.type]}</p>
              <h2 className="mt-1 text-xl">{s.pandalName}</h2>
              <p className="text-muted-foreground mt-1 text-xs">Received {formatDate(s.createdAt, "en")}</p>
              <p className="mt-3 text-sm whitespace-pre-line">{s.details}</p>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                {s.pandalId ? (
                  <div>
                    <dt className="inline font-semibold">Existing pandal: </dt>
                    <dd className="inline">
                      <Link className="underline underline-offset-4" href={`/admin/pandals/${s.pandalId}`}>
                        open in editor
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {s.sourceUrl ? (
                  <div>
                    <dt className="inline font-semibold">Source: </dt>
                    <dd className="inline break-all">
                      <a
                        className="underline underline-offset-4"
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        {s.sourceUrl}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {s.lat != null && s.lng != null ? (
                  <div>
                    <dt className="inline font-semibold">Suggested pin: </dt>
                    <dd className="inline">
                      <a
                        className="underline underline-offset-4"
                        href={placeUrl({ lat: s.lat, lng: s.lng })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.lat}, {s.lng}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {s.contactEmail ? (
                  <div>
                    <dt className="inline font-semibold">Contact: </dt>
                    <dd className="inline">{s.contactEmail}</dd>
                  </div>
                ) : null}
                {s.reviewNote ? (
                  <div className="sm:col-span-2">
                    <dt className="inline font-semibold">Review note: </dt>
                    <dd className="inline">{s.reviewNote}</dd>
                  </div>
                ) : null}
              </dl>
              {s.status === "pending" ? (
                <form action={reviewSubmission} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="min-w-48 flex-1">
                    <label htmlFor={`note-${s.id}`} className="field-label">
                      Review note (optional)
                    </label>
                    <input id={`note-${s.id}`} name="note" maxLength={500} className="field" />
                  </div>
                  <button type="submit" name="decision" value="accepted" className="btn btn-primary">
                    Accept
                  </button>
                  <button type="submit" name="decision" value="rejected" className="btn btn-danger">
                    Reject
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
