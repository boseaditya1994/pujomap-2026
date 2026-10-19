# Architecture

## Overview

```
Browser ──► Next.js 16 (App Router, React 19) on Vercel
              │  pages + server actions + route handlers
              ├─► Supabase: PostgreSQL + PostGIS, Auth, row-level security
              └─► Google Routes API (server key, on request only)
Browser ──► Google Maps JavaScript API (browser key, loaded only on the map screen)
Browser ──► google.com/maps deep links (no API, no cost)
```

Stack: Next.js 16, TypeScript (strict), Tailwind CSS 4, shadcn/ui (Base UI), `@vis.gl/react-google-maps`,
`@googlemaps/markerclusterer`, Supabase (`@supabase/ssr`), Zod, Vitest, Playwright.

## Folder structure

```
src/
  app/
    (site)/[lang]/        public pages: home, explore, pandals/[slug], plan, routes, saved, submit
    (admin)/admin/        admin portal + actions.ts (all privileged server actions)
    api/pandals           public search endpoint (PostGIS in production)
    api/routes/estimate   Google Routes proxy, slugs in, distance/duration out
    api/admin/csv-template
  components/             ui/ (shadcn), map/, pandal/, explore/, plan/, admin/, site/
  lib/
    domain/               pure logic, no I/O: types+schemas, geo, filters, csv, route-plan, deeplinks
    data/                 repository interface, Supabase + local implementations, cached queries
    google/               Routes API client
    auth/                 admin checks (server only)
    i18n/                 en.ts, bn.ts
    client/               localStorage stores, form helper
  proxy.ts                locale redirect + admin session refresh
supabase/migrations       schema, indexes, RLS, audit triggers, search function
supabase/seed.sql         six curated route shells (no pandals)
data/                     CSV template and example
tests/unit, tests/e2e
```

The rule: `domain` knows nothing about React, Supabase or Google. UI and data both depend on it, never on each other.

## Data model

| Table            | Purpose                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `pandals`        | One row per pandal. `latitude`/`longitude` plus generated `location geography(Point)` and `search tsvector`. |
| `pandal_images`  | Ordered photos with alt text, credit and source.                                                             |
| `curated_routes` | Route metadata; start is a place _name_, not coordinates.                                                    |
| `route_stops`    | Ordered pandals in a route (max 10).                                                                         |
| `submissions`    | Community suggestions; insert-only for visitors, readable by admins.                                         |
| `audit_log`      | Append-only, written by triggers on every admin change.                                                      |
| `admin_users`    | Who is an administrator. Editable only from the SQL editor.                                                  |

Indexes: GiST on `location`, GIN on `search`, trigram on `name`, partial b-trees on region and verification status.

Constraints worth knowing: coordinates must fall in the Greater Kolkata box; `theme_status = 'confirmed'` requires
title, source and a `theme_year` equal to the festival year in `app_settings` (enforced by a trigger); `verification_status = 'verified'` requires source and date.

## Key decisions

- **Directory is loaded once and filtered in the browser.** It is a few hundred small rows. Pages read it through a
  cached function (`use cache`, tag `pandals`), so most visits cost zero database queries and searching costs zero
  requests. Admin writes expire the tag. `/api/pandals` exposes the PostGIS search for integrations and for the day
  the list outgrows this approach.
- **No service-role key.** Visitors use the anon key; admins use their own session. RLS decides. A leaked
  environment cannot bypass the database rules.
- **Authorisation is checked three times**: `requireAdminPage()` in every admin page, `requireAdmin()` at the top of
  every server action, and RLS in the database.
- **Favourites, visited and saved plans live in `localStorage`.** No account needed, nothing personal stored
  server-side.
- **The visitor's location never enters a URL** and is never sent to our server except in a route-estimate request
  they explicitly trigger.
- **Routes API takes pandal slugs, not coordinates**, so the endpoint cannot be used as a free proxy for the key.
- **Nothing from Google is stored.** Estimates are returned with `no-store` and discarded.
- **Locale is in the path** (`/en`, `/bn`), so pages stay static and links carry their language.

## Graceful degradation

| Failure                                   | Behaviour                                                         |
| ----------------------------------------- | ----------------------------------------------------------------- |
| No Maps key / key rejected / script fails | Schematic pin view with an explanation; list and links unaffected |
| No Routes key, quota exhausted, timeout   | Clear message; "Open in Google Maps" still works                  |
| Location permission refused               | Notice; search and filters continue                               |
| Supabase not configured                   | Local mode with labelled sample data                              |

## Known limits

- The Supabase repository and Google Maps renderer are written against the documented APIs but **have not been run
  against live services** in this repository's test suite, which uses local mode. Verify both after first setup.
- Saving a pandal's photos or a route's stops is several statements, not one transaction.
- Favourites do not sync across devices.
- The in-memory rate limiter is per server instance. The real spending cap is the Google quota.
- Photos are added by URL; there is no upload UI yet (upload to Supabase Storage and paste the public URL).
- The festival year lives in two places that must agree: `NEXT_PUBLIC_FESTIVAL_YEAR` (app) and `app_settings.festival_year`
  (database). See "Rolling over to a new Puja year" in [admin-guide.md](admin-guide.md).
