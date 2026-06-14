# Supabase migrations

Three SQL files, run in order via the Supabase dashboard (Project → SQL Editor → New query). Each is idempotent — safe to re-run.

| # | File | What it does |
|---|------|--------------|
| 1 | `0001_workspace_schema.sql` | Creates the 8 workspace tables (`user_roles`, `pis`, `tags`, `products`, `designers`, `templates`, `template_tags`, `boards`, `assignments`) with indexes. |
| 2 | `0002_workspace_rls.sql` | Enables Row Level Security on every table, adds the `current_user_role()` helper, applies read-all / write-for-editor policies, and publishes the tables on the `supabase_realtime` channel. |
| 3 | `0003_migrate_roles_from_kv.sql` | Copies the existing `kv_store_3775ce8a` `user_role:*` entries into the new `user_roles` table. Run once after #2. |
| 4 | `0004_product_designers.sql` | Adds the `product_designers` M2M table linking each product to its team of designers. Designers stay a global pool; each product owns its own subset. |

## How to apply

1. Go to the Supabase dashboard → your project → **SQL Editor**.
2. Paste the contents of `0001_workspace_schema.sql`, click **Run**. Verify no errors.
3. Repeat with `0002_workspace_rls.sql`.
4. Repeat with `0003_migrate_roles_from_kv.sql`.
5. Re-deploy the edge function (`supabase functions deploy make-server-3775ce8a --no-verify-jwt`) so it starts writing roles to the `user_roles` table.
6. Confirm `charlotte.lopez@somfy.com` still has the `admin` role by querying:
   ```sql
   select au.email, ur.role
   from auth.users au
   left join user_roles ur on ur.user_id = au.id
   order by au.email;
   ```

## What the client now does

After the migrations land, `src/app/components/workspace-store.ts` reads/writes Postgres directly via the Supabase JS client and subscribes to Realtime on every workspace table. Two browsers logged in as editors see each other's changes within ~1s.

UI-only state (which PI / product / designer is "active") still lives in each browser's `localStorage` under `pi-planner:ui-prefs:v1` — that's intentional, so switching products on one machine doesn't switch them on another.

## First-run UX

The migrations leave the workspace **empty** — no seed PI, no seed products. On first launch an admin/editor sees an "empty workspace" screen offering to create the first PI; once that exists, the New Product dialog becomes available. Viewers see an empty-state message asking them to wait for an admin to set things up.
