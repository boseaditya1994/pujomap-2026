import { Accessibility, Clock, ExternalLink, Flag, MapPin, Navigation, TrainFront, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoBadge, ThemeLine, VerificationBadge } from "@/components/pandal/badges";
import { PandalActions } from "@/components/pandal/pandal-actions";
import { PandalPhoto } from "@/components/pandal/pandal-photo";
import { EmptyState, PageSkeleton } from "@/components/states";
import { getPandalBySlug, getPandals } from "@/lib/data/queries";
import { navigateUrl, placeUrl } from "@/lib/domain/deeplinks";
import { formatDistance } from "@/lib/domain/geo";
import { getThemeDisplay, nearbyPandals } from "@/lib/domain/pandal";
import { fmt, formatDate, getDictionary, isLocale, type Locale } from "@/lib/i18n";

type Props = PageProps<"/[lang]/pandals/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const t = getDictionary(isLocale(lang) ? lang : "en");
  const pandal = await getPandalBySlug(slug);
  if (!pandal) return { title: t.pandal.notFoundTitle };
  return {
    title: lang === "bn" && pandal.nameBn ? pandal.nameBn : pandal.name,
    description: `${pandal.neighbourhood}, ${t.regions[pandal.region]}. ${pandal.address}`,
  };
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

/** Sources are free text; only real web addresses become links. */
function Source({ value }: { value: string }) {
  return isHttpUrl(value) ? (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-all underline underline-offset-4"
    >
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
}

async function PandalDetail({ params }: { params: Props["params"] }) {
  const { lang: rawLang, slug } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;
  const t = getDictionary(lang);
  const pandal = await getPandalBySlug(slug);
  if (!pandal) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState title={t.pandal.notFoundTitle} body={t.pandal.notFoundBody}>
          <Link href={`/${lang}/explore`} className="btn btn-primary">
            {t.nav.explore}
          </Link>
        </EmptyState>
      </div>
    );
  }
  const nearby = nearbyPandals(await getPandals(), pandal);
  const name = lang === "bn" && pandal.nameBn ? pandal.nameBn : pandal.name;
  const theme = getThemeDisplay(pandal);
  const verificationBody =
    pandal.verificationStatus === "verified"
      ? t.pandal.verifiedBody
      : pandal.verificationStatus === "needs_review"
        ? t.pandal.needsReviewBody
        : t.pandal.unverifiedBody;

  const facts = [
    { icon: MapPin, label: t.pandal.address, value: pandal.address },
    { icon: TrainFront, label: t.pandal.nearestMetro, value: pandal.nearestMetro },
    { icon: Clock, label: t.pandal.schedule, value: pandal.openingSchedule },
    { icon: Users, label: t.pandal.committee, value: pandal.committee },
  ];

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8" data-testid="pandal-detail">
      <p className="text-vermilion text-sm font-semibold tracking-wider uppercase">
        {pandal.neighbourhood} · {t.regions[pandal.region]}
      </p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{name}</h1>
      {lang === "en" && pandal.nameBn ? (
        <p lang="bn" className="text-muted-foreground mt-1 text-lg">
          {pandal.nameBn}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VerificationBadge status={pandal.verificationStatus} t={t} />
        {pandal.isDemo ? <DemoBadge t={t} /> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          className="btn btn-accent"
          href={navigateUrl(pandal)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="navigate-link"
        >
          <Navigation className="size-4" aria-hidden />
          {t.pandal.navigate}
        </a>
        <a className="btn btn-outline" href={placeUrl(pandal)} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" aria-hidden />
          {t.pandal.viewPin}
        </a>
      </div>
      <div className="mt-3">
        <PandalActions slug={pandal.slug} name={name} showShare />
      </div>

      {pandal.description ? <p className="mt-6 leading-relaxed whitespace-pre-line">{pandal.description}</p> : null}

      <section aria-labelledby="theme-heading" className="bg-card mt-8 rounded-2xl border p-5">
        <h2 id="theme-heading" className="text-xl">
          {t.pandal.theme}
        </h2>
        <ThemeLine pandal={pandal} t={t} lang={lang} className="mt-2 text-base" />
        {theme.kind === "confirmed" ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {t.pandal.source}: <Source value={theme.source} />
          </p>
        ) : null}
      </section>

      <section aria-labelledby="facts-heading" className="bg-card mt-6 rounded-2xl border p-5">
        <h2 id="facts-heading" className="sr-only">
          {t.pandal.address}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="text-maroon size-5 shrink-0" aria-hidden />
                {label}
              </dt>
              <dd className={value ? "mt-0.5 pl-7 whitespace-pre-line" : "text-muted-foreground mt-0.5 pl-7"}>
                {value ?? t.pandal.notRecorded}
              </dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-2 text-sm font-semibold">
              <Accessibility className="text-maroon size-5 shrink-0" aria-hidden />
              {t.pandal.accessibility}
            </dt>
            <dd className={pandal.wheelchairAccess === "unknown" ? "text-muted-foreground mt-0.5 pl-7" : "mt-0.5 pl-7"}>
              {t.pandal.wheelchair[pandal.wheelchairAccess]}
              {pandal.accessibilityNotes ? (
                <span className="text-muted-foreground block text-sm">{pandal.accessibilityNotes}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="verification-heading"
        className="bg-card mt-6 rounded-2xl border p-5"
        data-testid="verification"
      >
        <h2 id="verification-heading" className="text-xl">
          {t.pandal.verificationTitle}
        </h2>
        <p className="mt-2 text-sm">{verificationBody}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">{t.pandal.source}</dt>
            <dd className={pandal.verificationSource ? undefined : "text-muted-foreground"}>
              {pandal.verificationSource ? <Source value={pandal.verificationSource} /> : t.pandal.notRecorded}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t.pandal.lastVerified}</dt>
            <dd className={pandal.lastVerifiedAt ? undefined : "text-muted-foreground"}>
              {pandal.lastVerifiedAt ? formatDate(pandal.lastVerifiedAt, lang) : t.pandal.notRecorded}
            </dd>
          </div>
        </dl>
        <Link
          href={`/${lang}/submit?pandal=${pandal.slug}&type=location_report`}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          <Flag className="size-4" aria-hidden />
          {t.pandal.report}
        </Link>
      </section>

      <section aria-labelledby="gallery-heading" className="mt-8">
        <h2 id="gallery-heading" className="text-xl">
          {t.pandal.gallery}
        </h2>
        {pandal.images.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{t.pandal.noPhotos}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pandal.images.map((img, i) => (
              <li key={img.url}>
                <figure>
                  <PandalPhoto src={img.url} alt={img.alt || name} priority={i === 0} />
                  {img.credit ? (
                    <figcaption className="text-muted-foreground mt-1 text-xs">
                      {fmt(t.pandal.photoCredit, { credit: img.credit })}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="nearby-heading" className="mt-8">
        <h2 id="nearby-heading" className="text-xl">
          {t.pandal.nearby}
        </h2>
        {nearby.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{t.pandal.noNearby}</p>
        ) : (
          <ul className="bg-card mt-3 divide-y rounded-2xl border" data-testid="nearby-list">
            {nearby.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${lang}/pandals/${p.slug}`}
                  className="hover:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {lang === "bn" && p.nameBn ? p.nameBn : p.name}
                    </span>
                    <span className="text-muted-foreground block text-sm">
                      {fmt(t.explore.away, { distance: formatDistance(p.distanceM, lang) })}
                    </span>
                  </span>
                  <VerificationBadge status={p.verificationStatus} t={t} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

export default function PandalPage({ params }: Props) {
  // The slug is only known per request, so the whole page streams inside this boundary.
  return (
    <Suspense fallback={<PageSkeleton label="Loading…" />}>
      <PandalDetail params={params} />
    </Suspense>
  );
}
