-- Make the festival year a setting instead of a literal in a constraint.
--
-- Yearly rollover (see docs/admin-guide.md):
--   update public.app_settings set festival_year = 2027;
-- and set NEXT_PUBLIC_FESTIVAL_YEAR=2027 in Vercel, then redeploy.

create table public.app_settings (
  id boolean primary key default true check (id),
  festival_year integer not null check (festival_year between 2000 and 2100)
);
insert into public.app_settings (festival_year) values (2026);

alter table public.app_settings enable row level security;
create policy "settings are public" on public.app_settings
  for select to anon, authenticated using (true);
-- No write policy: change it from the SQL editor.

-- A check constraint cannot read another table, so the year rule moves to a trigger.
alter table public.pandals drop constraint confirmed_theme_is_current_and_sourced;
alter table public.pandals add constraint confirmed_theme_is_sourced check (
  theme_status <> 'confirmed' or (theme_title is not null and theme_source is not null)
);

create or replace function public.check_confirmed_theme_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_year integer;
begin
  if new.theme_status = 'confirmed' then
    select festival_year into current_year from public.app_settings;
    if new.theme_year is distinct from current_year then
      raise exception 'Only a % theme can be confirmed; earlier themes are historical', current_year
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger pandals_confirmed_theme_year
  before insert or update on public.pandals
  for each row execute function public.check_confirmed_theme_year();
