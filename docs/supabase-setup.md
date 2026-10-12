# Supabase setup

The free tier is enough for this project.

## 1. Create the project

1. Create a project at supabase.com. Pick the Mumbai (`ap-south-1`) region for the lowest latency from Kolkata.
2. Project Settings → API: copy the **Project URL** and the **anon / publishable key** into
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Do **not** copy the service-role key anywhere. The app does not use it.

## 2. Apply the schema

Either with the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

or paste `supabase/migrations/20261012000000_initial_schema.sql` into the SQL editor and run it. It enables
PostGIS and `pg_trgm`, creates the tables, indexes, constraints, audit triggers, RLS policies and the
`search_pandals` function.

Then run `supabase/seed.sql` to create the six curated route shells (no stops, no pandals).

## 3. Create the first administrator

1. Authentication → Users → **Add user**. Enter the admin's email and a strong password, with "Auto confirm" on.
2. Authentication → Sign In / Providers: turn **off** "Allow new users to sign up". Admins are created by you.
3. In the SQL editor:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@example.org';
```

Being signed in is not enough; only users in `admin_users` can write. Remove a row to revoke access.

## 4. Check row-level security

Run these in the SQL editor to confirm the policies behave:

```sql
-- As an anonymous visitor: published pandals only, no submissions, no audit log
set local role anon;
select count(*) from public.pandals;      -- allowed
select count(*) from public.submissions;  -- 0 rows
select count(*) from public.audit_log;    -- 0 rows
insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
values ('x','x','xxx',22.5,88.3,'xx','north'); -- must fail
reset role;
```

## 5. Photos (optional)

Create a **public** Storage bucket (for example `pandal-photos`), upload images, and paste each public URL into the
pandal's Photos section in the admin. The Supabase host is automatically allowed through the image optimiser.

## Notes

- The audit log is written by database triggers, so changes made from the SQL editor by a signed-in user are logged
  too; changes made as `postgres` have no actor and are skipped.
- Run the migration before the first deploy. Pages read the directory at build time.
- This setup was written from Supabase's documentation and has not been exercised against a live project from this
  repository. Walk through section 4 before trusting it.
