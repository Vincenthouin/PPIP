-- =========================================================================
-- PPIP — copy existing roles from kv_store_3775ce8a into user_roles
-- =========================================================================
-- One-shot. Idempotent (upsert).
-- Keys in kv_store look like: 'user_role:<uuid>' with a json string value.
-- Orphan entries (user no longer in auth.users) are skipped via the join.

with parsed as (
  select
    (regexp_replace(key, '^user_role:', ''))::uuid as user_id,
    case
      when value::text = '"admin"'  then 'admin'
      when value::text = '"editor"' then 'editor'
      else 'viewer'
    end as role
  from kv_store_3775ce8a
  where key like 'user_role:%'
)
insert into user_roles (user_id, role)
select p.user_id, p.role
from parsed p
join auth.users u on u.id = p.user_id   -- skip orphan kv entries
on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

-- Optional cleanup: report (don't delete) orphan entries so you know which
-- kv rows are stale. Comment this out if you don't want the NOTICE noise.
do $$
declare orphan_count int;
begin
  select count(*) into orphan_count
  from kv_store_3775ce8a kv
  where kv.key like 'user_role:%'
    and not exists (
      select 1 from auth.users u
      where u.id = (regexp_replace(kv.key, '^user_role:', ''))::uuid
    );
  if orphan_count > 0 then
    raise notice 'Skipped % orphan kv_store role entries (user no longer in auth.users).', orphan_count;
  end if;
end$$;
