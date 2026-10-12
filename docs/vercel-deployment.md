# Vercel deployment

Do [Supabase setup](supabase-setup.md) and [Google Cloud setup](google-cloud-setup.md) first.

## Steps

1. Push the repository to GitHub (or GitLab / Bitbucket).
2. vercel.com → Add New → Project → import the repository. The framework is detected as Next.js; keep the defaults.
3. Add environment variables (Settings → Environment Variables) for Production, and Preview if you want previews
   to use real data:

| Variable                          | Required      | Notes                                      |
| --------------------------------- | ------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`            | yes           | `https://your-domain`                      |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes           |                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | yes           |                                            |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | for map       | Without it visitors get the schematic view |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | no            |                                            |
| `GOOGLE_ROUTES_API_KEY`           | for estimates | Mark as Sensitive                          |
| `NEXT_PUBLIC_IMAGE_HOSTS`         | no            |                                            |

Do **not** set `PUJOMAP_DEV_ADMIN_TOKEN` on Vercel. It is ignored when Supabase is configured, and without Supabase
the site would be serving sample data.

4. Deploy. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
5. Add your domain (Settings → Domains), then add it to the browser key's referrer list in Google Cloud.

## After the first deploy

- `/en` loads without the yellow "Sample data" banner. If the banner shows, the Supabase variables are missing.
- `/en/explore` shows the Google map.
- `/admin` redirects to `/admin/login`; signing in with the admin account works.
- A two-stop plan returns a route estimate.
- Response headers include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

## Cost notes

- The Hobby plan is for non-commercial use; check Vercel's terms if the site carries sponsorship or ads.
- Public pages are prerendered and served from the CDN, so traffic spikes mostly cost bandwidth, not compute.
- Image optimisation is limited to allow-listed hosts.

## Updating data

Directory changes made in the admin portal appear immediately; no redeploy is needed.
