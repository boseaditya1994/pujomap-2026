# Data sourcing guide

PujoMap ships with no real pandal data. This is how to build the directory without publishing guesses.

## Principles

1. **Every published fact has a source someone can check.** Record it in `verification_source` or `theme_source`.
2. **Unknown stays blank.** A blank field shows "Not recorded"; a wrong one sends a family to the wrong street.
3. **Last year is not this year.** Committees change themes annually and sometimes move sites. A 2025 theme may be
   stored with `theme_year=2025`, and will always be shown as an earlier year.
4. **Dates matter.** `last_verified_date` is when you checked, not when you typed it in.

## Acceptable sources

| Fact               | Good sources                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Existence, address | The committee's own page or social account; official police / civic Puja guide maps for 2026                              |
| Coordinates        | A volunteer's GPS reading at the site; a point you placed yourself on OpenStreetMap-based tools after confirming the site |
| 2026 theme         | Committee announcement; named press coverage from 2026                                                                    |
| Metro, schedule    | Metro Railway Kolkata notices; committee announcement                                                                     |
| Accessibility      | A site visit, or the committee in writing                                                                                 |

Not acceptable: an unsourced list, a previous year's guide, an AI-generated answer, "everyone knows".

## Coordinates and Google's terms

Do not harvest coordinates in bulk from Google Maps (search results, Places, geocoding) into the database; Google's
terms restrict storing that content. Using Google Maps to _look at_ a pin you already have, as the admin pin check
does, is fine. The safest sources are your own GPS readings and data under an open licence, used with the
attribution that licence asks for.

## Photos

Use only images you took, were given permission to use, or that carry a licence allowing reuse. Always fill in the
credit. Do not hotlink press photos.

## Suggested workflow

1. Collect candidates in the CSV template with `verification_status=unverified`. Import them: they appear with an
   "Unverified" badge, which is honest and already useful.
2. Verify area by area. As each pandal is checked, set the status to `verified` with source and date.
3. Add 2026 themes as committees announce them, each with its source.
4. During Puja, watch the Submissions queue; visitors on the ground are the fastest error reports you have.
5. Mark anything disputed as `needs_review` until it is settled.

## CSV columns

`name`, `address`, `latitude`, `longitude`, `neighbourhood` and `region` are required.

| Column                 | Values                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| `region`               | `north`, `central`, `south`, `salt-lake`, `dum-dum`, `behala`, `other`         |
| `latitude`/`longitude` | Decimal degrees, inside 22.30–22.95 N and 88.10–88.65 E                        |
| `theme_status`         | `confirmed` (needs title, source, `theme_year=2026`), `unconfirmed`, `unknown` |
| `wheelchair_access`    | `yes`, `partial`, `no`, `unknown`                                              |
| `verification_status`  | `verified` (needs source and date), `needs_review`, `unverified`               |
| `last_verified_date`   | `YYYY-MM-DD`                                                                   |

See `data/pandals.template.csv` and `data/pandals.example.csv`.
