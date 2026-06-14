-- =========================================================================
-- PPIP — product_designers: many-to-many between products and designers
-- =========================================================================
-- Designers are a global pool (organization-wide), but each product owns its
-- own subset (the people scheduled on that product's PI boards).
--
-- Apply AFTER 0001..0003. Idempotent.

create table if not exists product_designers (
  product_id  text not null references products(id)  on delete cascade,
  designer_id text not null references designers(id) on delete cascade,
  added_at    timestamptz not null default now(),
  added_by    uuid references auth.users(id),
  primary key (product_id, designer_id)
);

create index if not exists product_designers_product_idx  on product_designers(product_id);
create index if not exists product_designers_designer_idx on product_designers(designer_id);

-- ---- RLS (same pattern as other workspace tables) ------------------------
alter table product_designers enable row level security;

drop policy if exists product_designers_read on product_designers;
drop policy if exists product_designers_ins  on product_designers;
drop policy if exists product_designers_upd  on product_designers;
drop policy if exists product_designers_del  on product_designers;

create policy product_designers_read on product_designers
  for select to authenticated using (true);

create policy product_designers_ins on product_designers
  for insert to authenticated
  with check (public.current_user_role() in ('editor','admin'));

create policy product_designers_upd on product_designers
  for update to authenticated
  using (public.current_user_role() in ('editor','admin'))
  with check (public.current_user_role() in ('editor','admin'));

create policy product_designers_del on product_designers
  for delete to authenticated
  using (public.current_user_role() in ('editor','admin'));

-- ---- Realtime publication ------------------------------------------------
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table product_designers';
  exception when duplicate_object then
    null;
  end;
end$$;
