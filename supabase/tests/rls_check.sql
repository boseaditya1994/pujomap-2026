-- Verifies row-level security, constraints, the audit trigger and PostGIS search
-- against a real database. Everything it writes is rolled back.
--
--   npx supabase db query --linked -f supabase/tests/rls_check.sql
--
-- Returns one JSON object: each key is a check, each value should be true.

create or replace function pg_temp.pujomap_rls_check() returns jsonb
language plpgsql
as $fn$
declare
  r jsonb := '{}'::jsonb;
  n integer;
  admin_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  hidden_id uuid;
  dist double precision;
begin
  begin
    -- Fixtures, created as the database owner.
    insert into auth.users (id, instance_id, aud, role, email)
    values (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-check-admin@example.invalid'),
           (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-check-other@example.invalid');
    insert into public.admin_users (user_id) values (admin_id);
    insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
    values ('RLS Check Visible', 'rls-check-visible', 'Test address', 22.5726, 88.3639, 'Testpara', 'central');
    insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region, published)
    values ('RLS Check Hidden', 'rls-check-hidden', 'Test address', 22.58, 88.37, 'Testpara', 'central', false)
    returning id into hidden_id;
    insert into public.submissions (type, pandal_name, details) values ('new_pandal', 'RLS Check', 'Fixture submission row');

    -- Constraints (owner bypasses RLS, so these test the table rules themselves).
    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region, theme_status, theme_title, theme_source, theme_year)
      values ('x1', 'rls-x1', 'Test address', 22.5, 88.3, 'Testpara', 'north', 'confirmed', 'Old', 'src', 2025);
      r := r || '{"historical_theme_cannot_be_confirmed": false}';
    exception when check_violation then r := r || '{"historical_theme_cannot_be_confirmed": true}';
    end;
    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region, verification_status)
      values ('x2', 'rls-x2', 'Test address', 22.5, 88.3, 'Testpara', 'north', 'verified');
      r := r || '{"verified_needs_source_and_date": false}';
    exception when check_violation then r := r || '{"verified_needs_source_and_date": true}';
    end;
    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
      values ('x3', 'rls-x3', 'Test address', 28.61, 77.20, 'Testpara', 'north');
      r := r || '{"coordinates_outside_kolkata_rejected": false}';
    exception when check_violation then r := r || '{"coordinates_outside_kolkata_rejected": true}';
    end;

    -- Anonymous visitor.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    select count(*) into n from public.pandals where slug like 'rls-check-%';
    r := r || jsonb_build_object('anon_sees_only_published_pandals', n = 1);
    select count(*) into n from public.submissions;
    r := r || jsonb_build_object('anon_cannot_read_submissions', n = 0);
    select count(*) into n from public.audit_log;
    r := r || jsonb_build_object('anon_cannot_read_audit_log', n = 0);
    select count(*) into n from public.admin_users;
    r := r || jsonb_build_object('anon_cannot_read_admin_list', n = 0);

    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
      values ('x4', 'rls-x4', 'Test address', 22.5, 88.3, 'Testpara', 'north');
      r := r || '{"anon_cannot_insert_pandal": false}';
    exception when insufficient_privilege then r := r || '{"anon_cannot_insert_pandal": true}';
    end;
    update public.pandals set name = 'defaced' where slug = 'rls-check-visible';
    get diagnostics n = row_count;
    r := r || jsonb_build_object('anon_cannot_update_pandal', n = 0);
    delete from public.pandals where slug = 'rls-check-visible';
    get diagnostics n = row_count;
    r := r || jsonb_build_object('anon_cannot_delete_pandal', n = 0);

    begin
      insert into public.submissions (type, pandal_name, details) values ('new_pandal', 'Anon suggestion', 'A perfectly valid suggestion');
      r := r || '{"anon_can_submit_pending_suggestion": true}';
    exception when others then r := r || jsonb_build_object('anon_can_submit_pending_suggestion', false, 'anon_submit_error', sqlerrm);
    end;
    begin
      insert into public.submissions (type, pandal_name, details, status) values ('new_pandal', 'Sneaky', 'Tries to self-approve this', 'accepted');
      r := r || '{"anon_cannot_submit_pre_accepted": false}';
    exception when insufficient_privilege then r := r || '{"anon_cannot_submit_pre_accepted": true}';
    end;
    begin
      insert into public.admin_users (user_id) values (other_id);
      r := r || '{"anon_cannot_grant_admin": false}';
    exception when insufficient_privilege then r := r || '{"anon_cannot_grant_admin": true}';
    end;

    -- PostGIS search as a visitor: the visible fixture is ~0 m from its own coordinates.
    select distance_m into dist from public.search_pandals('rls check', null, false, 22.5726, 88.3639, 500, 10)
    where slug = 'rls-check-visible';
    r := r || jsonb_build_object('search_finds_published_with_distance', dist is not null and dist < 1);
    select count(*) into n from public.search_pandals('rls check hidden');
    r := r || jsonb_build_object('search_hides_unpublished', n = 0);

    -- Signed-in user who is NOT an administrator.
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated', 'email', 'rls-check-other@example.invalid')::text, true);
    r := r || jsonb_build_object('non_admin_is_not_admin', public.is_admin() = false);
    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
      values ('x5', 'rls-x5', 'Test address', 22.5, 88.3, 'Testpara', 'north');
      r := r || '{"non_admin_cannot_insert_pandal": false}';
    exception when insufficient_privilege then r := r || '{"non_admin_cannot_insert_pandal": true}';
    end;
    select count(*) into n from public.submissions;
    r := r || jsonb_build_object('non_admin_cannot_read_submissions', n = 0);
    select count(*) into n from public.pandals where id = hidden_id;
    r := r || jsonb_build_object('non_admin_cannot_see_unpublished', n = 0);

    -- Administrator.
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated', 'email', 'rls-check-admin@example.invalid')::text, true);
    r := r || jsonb_build_object('admin_is_admin', public.is_admin());
    begin
      insert into public.pandals (name, slug, address, latitude, longitude, neighbourhood, region)
      values ('RLS Check Admin Made', 'rls-check-admin-made', 'Test address', 22.5, 88.3, 'Testpara', 'north');
      r := r || '{"admin_can_insert_pandal": true}';
    exception when others then r := r || jsonb_build_object('admin_can_insert_pandal', false, 'admin_insert_error', sqlerrm);
    end;
    select count(*) into n from public.pandals where id = hidden_id;
    r := r || jsonb_build_object('admin_sees_unpublished', n = 1);
    select count(*) into n from public.submissions;
    r := r || jsonb_build_object('admin_reads_submissions', n >= 2);
    select count(*) into n from public.audit_log
    where actor_id = admin_id and action = 'insert' and entity_type = 'pandals' and actor_email = 'rls-check-admin@example.invalid';
    r := r || jsonb_build_object('audit_trigger_records_admin_insert', n = 1);
    begin
      delete from public.audit_log;
      get diagnostics n = row_count;
      r := r || jsonb_build_object('admin_cannot_erase_audit_log', n = 0);
    exception when insufficient_privilege then r := r || '{"admin_cannot_erase_audit_log": true}';
    end;

    execute 'reset role';
    -- Undo every fixture and test write.
    raise exception 'pujomap_rls_check_rollback';
  exception
    when raise_exception then
      if sqlerrm <> 'pujomap_rls_check_rollback' then
        raise;
      end if;
  end;
  return r;
end;
$fn$;

select pg_temp.pujomap_rls_check() as checks;
