# Google Cloud setup, billing and cost control

## What the app uses

| Google product                | Where                       | Key         | Billed?      |
| ----------------------------- | --------------------------- | ----------- | ------------ |
| Maps JavaScript API           | Explore map                 | Browser key | Per map load |
| Routes API (`computeRoutes`)  | "Get route estimate" button | Server key  | Per request  |
| Google Maps URLs (deep links) | Navigate / Open in Maps     | none        | Free         |

Places API (New) is **not** called. Start locations are passed to Google as text, and pandal data is our own.

## 1. Project and billing

Google Maps Platform requires a billing account on the project even to use the free monthly allowance. Creating one
needs a payment method and is something only you can do:

1. console.cloud.google.com → create a project.
2. Billing → link a billing account.
3. APIs & Services → Library → enable **Maps JavaScript API** and **Routes API**. Enable nothing else.

Pricing is per SKU with a free monthly usage cap for each; the caps and prices change, so read the current
[pricing page](https://developers.google.com/maps/billing-and-pricing/pricing) rather than relying on a number here.
The app is built to stay in the cheapest tier of each product (see "How the app keeps usage low").

## 2. Two keys, both restricted

**Browser key** → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

- Application restriction: **Websites**. Add `https://your-domain/*`, your Vercel preview pattern if you want maps
  in previews, and `http://localhost:3000/*` for development.
- API restriction: **Maps JavaScript API** only.

This key is visible to every visitor by design. The referrer restriction is what stops others using it.

**Server key** → `GOOGLE_ROUTES_API_KEY`

- API restriction: **Routes API** only.
- Application restriction: none is practical on Vercel (no fixed IPs), so the API restriction and the quota below
  are the protection. Never give this variable a `NEXT_PUBLIC_` prefix.

Optional: Map Management → create a **Map ID** (JavaScript, vector) for custom styling and set
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Blank uses Google's `DEMO_MAP_ID`.

## 3. Set hard limits before launch

Budgets only _alert_; quotas actually _stop_ usage. Set both.

**Quotas** (APIs & Services → Enabled APIs → pick the API → Quotas & System Limits):

- Maps JavaScript API → "Map loads per day": set a ceiling you are comfortable paying for.
- Routes API → "Compute Routes requests per day" (and per minute): same.

When a quota is hit the map falls back to the schematic view and estimates show "unavailable". The site keeps working.

**Budget alerts** (Billing → Budgets & alerts → Create budget):

- Scope: this project. Amount: your monthly comfort level.
- Alert thresholds at 50%, 90% and 100% of actual spend, emailed to billing admins.

Check Billing → Reports during the Puja week; traffic will be concentrated in about five days.

## How the app keeps usage low

- The Maps script is downloaded only on the explore screen, and only when a key is set. Pandal pages use a free
  deep link instead of an embedded map.
- Search, filters and "near me" run in the browser on our own data: no Google calls.
- Markers are clustered and drawn without per-marker React components.
- Route estimates are requested only when a visitor presses the button, never automatically.
- Route requests ask for distance and duration only (field mask), use `TRAFFIC_UNAWARE` for driving, and are capped at
  10 stops, which keeps them out of the higher-priced tiers.
- The server endpoint accepts pandal slugs only and is rate-limited per client.

## Terms compliance

- No Google Maps content (tiles, route results, geocodes) is stored or cached by this app. Route responses are sent
  with `Cache-Control: no-store`.
- The Google map is shown with its attribution and controls intact.
- Pandal coordinates must come from your own verification work, not be copied out of Google Maps. See
  [data-sourcing.md](data-sourcing.md).

## Not yet verified

No Google key was available while this was built. The live map and Routes integration follow the documented APIs
and their failure paths are tested, but the success paths need a check with real keys: load `/en/explore`, select a
marker, and press "Get route estimate" on a two-stop plan.
