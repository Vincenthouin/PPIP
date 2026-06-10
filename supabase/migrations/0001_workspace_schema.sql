-- =========================================================================
-- PPIP — workspace schema (single shared workspace, POC)
-- =========================================================================
-- Run this whole file in the Supabase SQL editor (Project → SQL → New query).
-- Idempotent: safe to re-run.

-- ---- user_roles -----------------------------------------------------------
create table if not exists user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','editor','viewer')) default 'viewer',
  updated_at timestamptz not null default now()
);

-- ---- pis ------------------------------------------------------------------
create table if not exists pis (
  id               text primary key,
  name             text not null,
  start_date_iso   text not null,            -- keep ISO string; matches PiState.startDateISO
  sprint_count     int  not null,
  weeks_per_sprint int  not null,
  workday_hours    numeric not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---- tags (FK to products added after products table created) -------------
create table if not exists tags (
  id         text primary key,
  name       text not null,
  product_id text,
  created_at timestamptz not null default now()
);

-- ---- products -------------------------------------------------------------
create table if not exists products (
  id         text primary key,
  name       text not null,
  color      text not null,
  tag_id     text not null references tags(id),
  created_at timestamptz not null default now()
);

-- attach the deferred FK on tags.product_id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tags_product_id_fkey'
  ) then
    alter table tags
      add constraint tags_product_id_fkey
      foreign key (product_id) references products(id) on delete cascade;
  end if;
end$$;

-- ---- designers (the human resources scheduled on the board) ---------------
create table if not exists designers (
  id            text primary key,
  name          text not null,
  color         text not null,
  initials      text,
  auth_user_id  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---- templates ------------------------------------------------------------
create table if not exists templates (
  id                text primary key,
  name              text not null,
  color             text not null,
  lines             jsonb not null,            -- MeetingLine[]
  default_selected  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists template_tags (
  template_id text references templates(id) on delete cascade,
  tag_id      text references tags(id)      on delete cascade,
  primary key (template_id, tag_id)
);

-- ---- boards ---------------------------------------------------------------
create table if not exists boards (
  product_id      text references products(id) on delete cascade,
  pi_id           text references pis(id)      on delete cascade,
  preselected_ids text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  primary key (product_id, pi_id)
);

-- ---- assignments (= Board.categories) -------------------------------------
create table if not exists assignments (
  id           text primary key,
  product_id   text not null,
  pi_id        text not null,
  template_id  text references templates(id) on delete set null,
  designer_id  text references designers(id) on delete cascade,
  name         text not null,
  color        text not null,
  sprint_ids   text[] not null default '{}',
  lines        jsonb  not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint assignments_board_fk
    foreign key (product_id, pi_id) references boards(product_id, pi_id) on delete cascade
);

create index if not exists assignments_board_idx on assignments(product_id, pi_id);
create index if not exists assignments_designer_idx on assignments(designer_id);
create index if not exists tags_product_idx on tags(product_id);
create index if not exists products_tag_idx on products(tag_id);
