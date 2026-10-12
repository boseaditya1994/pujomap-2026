# Admin guide

Sign in at `/admin/login` with the account your project owner created. Everything you change is recorded in the
audit log with your email.

## Pandals

**Pandals → Add pandal**, or click a name to edit.

- **Identity**: name (and Bengali name if known). Leave the slug blank the first time; avoid changing it later,
  because links and visitors' saved favourites use it.
- **Location and pin check**: enter the address and decimal coordinates. Then use both buttons in the pin-check box:
  one opens your coordinates in Google Maps, the other searches the address. The pin should sit on the pandal site
  itself. Coordinates outside Greater Kolkata are rejected.
- **Nearest Metro / schedule**: fill in only what you have confirmed. Blank shows visitors "Not recorded".
- **Theme**:
  - _confirmed_ — only for a 2026 theme, with a source (committee post, press coverage). The form refuses anything else.
  - _unconfirmed_ — you have heard it but cannot source it yet.
  - An earlier year's theme may be recorded with its year; visitors see it labelled as an earlier year.
- **Verification**:
  - _verified_ — you checked the location against a source. Requires the source and the date.
  - _needs review_ — something has been questioned; visitors see a caution badge.
  - _unverified_ — the default.
- **Photos**: paste an HTTPS image address, describe the image (for screen-reader users) and credit the
  photographer. Only use photos you have permission to publish.
- **Published**: untick to hide a pandal without deleting it.

Deleting a pandal also removes it from curated routes and cannot be undone.

## CSV import

**CSV import** → download the template → fill it in → choose the file.

- The page checks the file immediately and lists every problem by spreadsheet row and column.
- Nothing is imported unless every row is valid.
- Rows whose slug already exists update that pandal; others are created. Photos are not touched by an import.
- The same theme and verification rules apply as in the form.

Save from Excel or Google Sheets as "CSV UTF-8" so Bengali text survives.

## Community submissions

**Submissions** lists what visitors have sent. For each one:

1. Read the claim and open the source link.
2. If it holds up, edit the pandal yourself (there is a shortcut link when the submission names an existing pandal),
   filling in the verification or theme source.
3. Mark the submission **Accept** or **Reject**, with a short note.

Accepting does not change any data by itself. That is deliberate: every published fact passes through a person.

## Curated routes

**Curated routes** → pick a route, or **Add route**.

- Add up to 10 published pandals and order them with the arrows.
- **Start place** is a name Google Maps can find, such as a Metro station. Do not enter coordinates.
- Prefer verified pandals; the picker marks the ones that are not.
- A route with no stops is listed without an "Open in planner" button.

## Audit log

The 200 most recent changes: who, when, what. Use it to trace a wrong edit back to its source.
