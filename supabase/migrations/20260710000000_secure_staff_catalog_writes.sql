-- Secure catalog administration with Supabase Auth.
-- A signed-in user is staff only when their JWT email matches an enabled
-- staff_members row. The SECURITY DEFINER helper avoids RLS recursion while
-- checking staff_members from catalog policies.

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_members s
    where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and s.is_admin = true
      and s.role in ('ops', 'admin', 'super_admin')
  );
$$;

revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

grant select on table public.staff_members to authenticated;
revoke insert, update, delete on table public.staff_members from anon;

alter table public.staff_members enable row level security;

drop policy if exists staff_authenticated_read on public.staff_members;
create policy staff_authenticated_read
on public.staff_members
for select
to authenticated
using (public.is_active_staff());

do $migration$
declare
  catalog_table text;
  old_policy record;
begin
  foreach catalog_table in array array[
    'shops',
    'products',
    'vendors',
    'delivery_areas',
    'care_packages'
  ]
  loop
    execute format('alter table public.%I enable row level security', catalog_table);
    execute format(
      'revoke insert, update, delete on table public.%I from anon',
      catalog_table
    );
    execute format(
      'grant insert, update, delete on table public.%I to authenticated',
      catalog_table
    );

    -- Remove earlier permissive mutation policies. Read policies are retained.
    for old_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = catalog_table
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format(
        'drop policy %I on public.%I',
        old_policy.policyname,
        catalog_table
      );
    end loop;

    execute format(
      'create policy catalog_staff_insert on public.%I for insert to authenticated with check (public.is_active_staff())',
      catalog_table
    );
    execute format(
      'create policy catalog_staff_update on public.%I for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff())',
      catalog_table
    );
    execute format(
      'create policy catalog_staff_delete on public.%I for delete to authenticated using (public.is_active_staff())',
      catalog_table
    );
  end loop;
end
$migration$;

-- Before deploying the frontend, create a Supabase Auth user for each existing
-- staff_members.email in Authentication > Users. Their Auth password replaces
-- the legacy plaintext staff_members.password value.
