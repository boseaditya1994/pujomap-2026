# PujoMap 2026

**Discover. Explore. Celebrate.** A map-first guide to Durga Puja pandals across Kolkata and Greater Kolkata: find
pandals near you, see what has been verified, plan a pandal-hopping route and open it in Google Maps.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: everything works blank
npm run dev
```

Open http://localhost:3000. With no environment variables the app runs in **local mode**:

| Feature         | Local mode (no keys)                               | Production                          |
| --------------- | -------------------------------------------------- | ----------------------------------- |
| Data            | 18 clearly-labelled sample pandals, held in memory | Supabase (PostgreSQL + PostGIS)     |
| Map             | Schematic pin view                                 | Google Maps with clustering         |
| Route estimates | "Not set up" message; Google Maps links still work | Google Routes API                   |
| Admin sign-in   | `PUJOMAP_DEV_ADMIN_TOKEN` at `/admin/login`        | Supabase Auth + `admin_users` table |

The sample pandals are **not real**. The repository ships no real pandal coordinates or themes; see
[docs/data-sourcing.md](docs/data-sourcing.md) for how to add them properly.

## Scripts

| Command            | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `npm run dev`      | Development server                                              |
| `npm run build`    | Production build                                                |
| `npm run check`    | Lint + type-check + unit tests                                  |
| `npm test`         | Unit tests (Vitest)                                             |
| `npm run test:e2e` | End-to-end tests (Playwright; builds and starts the app itself) |
| `npm run format`   | Prettier                                                        |

First e2e run: `npx playwright install chromium`.

## What is in the box

- **Explore** (`/en/explore`, `/bn/explore`): search, area / neighbourhood / verified-only filters, "near me",
  map and list in sync, shareable URLs.
- **Pandal pages**: theme with its trust level, verification source and date, accessibility, nearby pandals,
  Google Maps navigation.
- **Route planner** (`/en/plan`): up to 10 stops, reorder, four travel modes, Google route estimate, comparison with
  a nearest-first order, save on device, share by link, open in Google Maps.
- **Curated routes** for North, Central and South Kolkata, Salt Lake, Dum Dum and Behala.
- **Favourites and visited checklist**, stored on the visitor's device.
- **Community suggestions**, moderated before anything changes.
- **Admin portal** (`/admin`): pandal CRUD, CSV import, pin check, themes and photos, submission review, curated
  routes, audit log.
- English and Bengali throughout the public site.

## Trust rules the code enforces

1. A theme is shown as _confirmed_ only if it is for the current festival year (2026 by default, set by
   `NEXT_PUBLIC_FESTIVAL_YEAR`) **and** has a source. Any other year is labelled as an
   earlier year. Enforced in the UI, the validation schema, the CSV importer and a database constraint.
2. A pandal is _verified_ only with a verification source and date.
3. Unknown fields say "not recorded". Nothing is filled in by guesswork.
4. Distances shown without Google are labelled straight-line. Travel times only ever come from Google, on request.

## Documentation

- [Architecture](docs/architecture.md) — structure, data model, decisions, known limits
- [Supabase setup](docs/supabase-setup.md)
- [Google Cloud setup, billing and quotas](docs/google-cloud-setup.md)
- [Vercel deployment](docs/vercel-deployment.md)
- [Admin guide](docs/admin-guide.md)
- [Data sourcing guide](docs/data-sourcing.md)

## Licence

[MIT](LICENSE)
