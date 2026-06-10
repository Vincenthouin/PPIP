-- =========================================================================
-- PPIP — copy existing roles from kv_store_3775ce8a into user_roles
-- =========================================================================
-- One-shot. Idempotent (upsert).
-- Keys in kv_store look like: 'user_role:<uuid>' with a json string value.

insert into user_roles (user_id, role)
select
  (regexp_replace(key, '^user_role:', ''))::uuid as user_id,
  case
    when value::text = '"admin"'  then 'admin'
    when value::text = '"editor"' then 'editor'
    else 'viewer'
  end as role
from kv_store_3775ce8a
where key like 'user_role:%'
on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();
