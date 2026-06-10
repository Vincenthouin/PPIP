-- =========================================================================
-- PPIP — RLS policies + role helper
-- =========================================================================
-- Apply AFTER 0001_workspace_schema.sql.
-- Idempotent: drops & recreates each policy.

-- ---- helper ---------------------------------------------------------------
create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from user_roles where user_id = auth.uid()),
    'viewer'
  )
$$;

grant execute on function public.current_user_role() to authenticated;

-- ---- enable RLS on every table -------------------------------------------
alter table user_roles    enable row level security;
alter table pis           enable row level security;
alter table tags          enable row level security;
alter table products      enable row level security;
alter table designers     enable row level security;
alter table templates     enable row level security;
alter table template_tags enable row level security;
alter table boards        enable row level security;
alter table assignments   enable row level security;

-- ---- read-everything-for-authenticated, write-for-editors-and-admins -----
-- Done as a do-block so it's idempotent.
do $$
declare t text;
declare editor_tables text[] := array[
  'pis','tags','products','designers','templates','template_tags','boards','assignments'
];
begin
  foreach t in array editor_tables loop
    execute format('drop policy if exists %I_read  on %I', t, t);
    execute format('drop policy if exists %I_ins   on %I', t, t);
    execute format('drop policy if exists %I_upd   on %I', t, t);
    execute format('drop policy if exists %I_del   on %I', t, t);

    execute format(
      'create policy %I_read on %I for select to authenticated using (true)',
      t, t
    );
    execute format(
      'create policy %I_ins on %I for insert to authenticated
         with check (public.current_user_role() in (''editor'',''admin''))',
      t, t
    );
    execute format(
      'create policy %I_upd on %I for update to authenticated
         using (public.current_user_role() in (''editor'',''admin''))
         with check (public.current_user_role() in (''editor'',''admin''))',
      t, t
    );
    execute format(
      'create policy %I_del on %I for delete to authenticated
         using (public.current_user_role() in (''editor'',''admin''))',
      t, t
    );
  end loop;
end$$;

-- ---- user_roles : self-read + admin-only writes --------------------------
drop policy if exists user_roles_read_self on user_roles;
drop policy if exists user_roles_admin_all on user_roles;

create policy user_roles_read_self on user_roles for select to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy user_roles_admin_all on user_roles for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---- Realtime: publish all workspace tables ------------------------------
-- (Realtime listens on the supabase_realtime publication.)
do $$
declare t text;
declare rt_tables text[] := array[
  'pis','tags','products','designers','templates','template_tags','boards','assignments'
];
begin
  foreach t in array rt_tables loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end$$;
