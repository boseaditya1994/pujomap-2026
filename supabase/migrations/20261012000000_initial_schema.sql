-- PujoMap 2026 — initial schema
-- PostgreSQL + PostGIS, with row-level security on every table.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------
-- A user is an admin only if listed here. Rows are added by the project owner
-- from the SQL editor (see docs/supabase-setup.md); no API role can write it.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins can see the admin list" on public.admin_users
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Pandals
-- ---------------------------------------------------------------------------
create table public.pandals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  name_bn text check (char_length(name_bn) <= 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  address text not null check (char_length(address) between 3 and 500),
  -- Greater Kolkata bounding box; anything outside is a data-entry error.
  latitude double precision not null check (latitude between 22.30 and 22.95),
  longitude double precision not null check (longitude between 88.10 and 88.65),
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  neighbourhood text not null check (char_length(neighbourhood) between 2 and 120),
  region text not null check (region in ('north','central','south','salt-lake','dum-dum','behala','other')),
  committee text,
  description text,
  theme_year integer check (theme_year between 1900 and 2100),
  theme_title text,
  theme_status text not null default 'unknown' check (theme_status in ('confirmed','unconfirmed','unknown')),
  theme_source text,
  nearest_metro text,
  opening_schedule text,
  wheelchair_access text not null default 'unknown' check (wheelchair_access in ('yes','partial','no','unknown')),
  accessibility_notes text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','needs_review','unverified')),
  verification_source text,
  last_verified_at date,
  published boolean not null default true,
  search tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' || coalesce(name_bn, '') || ' ' || coalesce(address, '') || ' ' ||
      coalesce(neighbourhood, '') || ' ' || coalesce(committee, '') || ' ' ||
      coalesce(nearest_metro, '') || ' ' || coalesce(theme_title, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A theme can only be marked confirmed for the 2026 festival, with a title and a source.
  -- Historical themes can be stored (theme_year < 2026) but never as confirmed.
  constraint confirmed_theme_is_current_and_sourced check (
    theme_status <> 'confirmed'
    or (theme_title is not null and theme_source is not null and theme_year = 2026)
  ),
  constraint verified_has_source_and_date check (
    verification_status <> 'verified'
    or (verification_source is not null and last_verified_at is not null)
  )
);

create index pandals_location_gix on public.pandals using gist (location);
create index pandals_search_gin on public.pandals using gin (search);
create index pandals_name_trgm on public.pandals using gin (name extensions.gin_trgm_ops);
create index pandals_region_idx on public.pandals (region, neighbourhood) where published;
create index pandals_verification_idx on public.pandals (verification_status) where published;

create table public.pandal_images (
  id uuid primary key default gen_random_uuid(),
  pandal_id uuid not null references public.pandals (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  alt text not null default '',
  credit text,
  source_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index pandal_images_pandal_idx on public.pandal_images (pandal_id, sort_order);

-- ---------------------------------------------------------------------------
-- Curated routes
-- ---------------------------------------------------------------------------
create table public.curated_routes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  region text not null check (region in ('north','central','south','salt-lake','dum-dum','behala','other')),
  title text not null,
  title_bn text,
  description text,
  description_bn text,
  -- A place name for Google Maps to resolve; deliberately not coordinates.
  start_label text,
  travel_mode text not null default 'walk' check (travel_mode in ('walk','drive','two_wheeler','transit')),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.route_stops (
  route_id uuid not null references public.curated_routes (id) on delete cascade,
  pandal_id uuid not null references public.pandals (id) on delete cascade,
  position integer not null check (position between 0 and 9),
  primary key (route_id, position),
  unique (route_id, pandal_id)
);
create index route_stops_pandal_idx on public.route_stops (pandal_id);

-- ---------------------------------------------------------------------------
-- Community submissions
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('new_pandal','location_report','theme_correction','accessibility_correction')),
  pandal_id uuid references public.pandals (id) on delete set null,
  pandal_name text not null check (char_length(pandal_name) between 2 and 200),
  details text not null check (char_length(details) between 10 and 3000),
  source_url text check (char_length(source_url) <= 2000),
  latitude double precision check (latitude between 22.30 and 22.95),
  longitude double precision check (longitude between 88.10 and 88.65),
  contact_email text check (char_length(contact_email) <= 320),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);
create index submissions_status_idx on public.submissions (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log (written only by triggers)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pandals_touch before update on public.pandals
  for each row execute function public.touch_updated_at();
create trigger curated_routes_touch before update on public.curated_routes
  for each row execute function public.touch_updated_at();

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j jsonb;
begin
  -- Anonymous inserts (community submissions) are not administrative actions.
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    j := to_jsonb(old);
  else
    j := to_jsonb(new);
  end if;
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary)
  values (
    (select auth.uid()),
    (select auth.jwt() ->> 'email'),
    lower(tg_op),
    tg_table_name,
    j ->> 'id',
    initcap(tg_op) || ' ' || tg_table_name || ': ' ||
      coalesce(j ->> 'name', j ->> 'title', j ->> 'pandal_name', '')
  );
  return coalesce(new, old);
end;
$$;

create trigger pandals_audit after insert or update or delete on public.pandals
  for each row execute function public.write_audit();
create trigger curated_routes_audit after insert or update or delete on public.curated_routes
  for each row execute function public.write_audit();
create trigger submissions_audit after update or delete on public.submissions
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.pandals enable row level security;
alter table public.pandal_images enable row level security;
alter table public.curated_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.submissions enable row level security;
alter table public.audit_log enable row level security;

create policy "published pandals are public" on public.pandals
  for select to anon, authenticated using (published or public.is_admin());
create policy "admins insert pandals" on public.pandals
  for insert to authenticated with check (public.is_admin());
create policy "admins update pandals" on public.pandals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete pandals" on public.pandals
  for delete to authenticated using (public.is_admin());

create policy "images of visible pandals are public" on public.pandal_images
  for select to anon, authenticated using (
    exists (select 1 from public.pandals p where p.id = pandal_id and (p.published or public.is_admin()))
  );
create policy "admins insert images" on public.pandal_images
  for insert to authenticated with check (public.is_admin());
create policy "admins update images" on public.pandal_images
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete images" on public.pandal_images
  for delete to authenticated using (public.is_admin());

create policy "published routes are public" on public.curated_routes
  for select to anon, authenticated using (published or public.is_admin());
create policy "admins insert routes" on public.curated_routes
  for insert to authenticated with check (public.is_admin());
create policy "admins update routes" on public.curated_routes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete routes" on public.curated_routes
  for delete to authenticated using (public.is_admin());

create policy "stops of visible routes are public" on public.route_stops
  for select to anon, authenticated using (
    exists (select 1 from public.curated_routes r where r.id = route_id and (r.published or public.is_admin()))
  );
create policy "admins insert stops" on public.route_stops
  for insert to authenticated with check (public.is_admin());
create policy "admins delete stops" on public.route_stops
  for delete to authenticated using (public.is_admin());

-- Anyone may file a submission, but only as a fresh pending one. Nobody but an
-- admin can read them (they may contain a contact email).
create policy "anyone can submit a pending suggestion" on public.submissions
  for insert to anon, authenticated
  with check (status = 'pending' and review_note is null and reviewed_by is null and reviewed_at is null);
create policy "admins read submissions" on public.submissions
  for select to authenticated using (public.is_admin());
create policy "admins review submissions" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete submissions" on public.submissions
  for delete to authenticated using (public.is_admin());

create policy "admins read the audit log" on public.audit_log
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: the log is append-only via triggers.

-- ---------------------------------------------------------------------------
-- Geospatial + full-text search (used by GET /api/pandals)
-- ---------------------------------------------------------------------------
create or replace function public.search_pandals(
  q text default null,
  p_region text default null,
  verified_only boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  radius_m double precision default null,
  max_rows integer default 200
)
returns table (
  id uuid,
  slug text,
  name text,
  neighbourhood text,
  region text,
  latitude double precision,
  longitude double precision,
  verification_status text,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with origin as (
    select case
      when p_lat is null or p_lng is null then null
      else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    end as g
  )
  select p.id, p.slug, p.name, p.neighbourhood, p.region, p.latitude, p.longitude,
         p.verification_status,
         case when o.g is null then null else st_distance(p.location, o.g) end as distance_m
  from public.pandals p cross join origin o
  where p.published
    and (q is null or btrim(q) = ''
         or p.search @@ websearch_to_tsquery('simple', q)
         or p.name ilike '%' || btrim(q) || '%')
    and (p_region is null or p.region = p_region)
    and (not verified_only or p.verification_status = 'verified')
    and (o.g is null or radius_m is null or st_dwithin(p.location, o.g, radius_m))
  order by distance_m nulls last, p.name
  limit least(greatest(coalesce(max_rows, 200), 1), 500);
$$;
grant execute on function public.search_pandals to anon, authenticated;
