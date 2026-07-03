-- Migration PPIP v1.2
-- À exécuter dans l'éditeur SQL de ton projet Supabase

-- Amélioration 1 — ordre drag & drop par sprint
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS order_by_sprint_id jsonb DEFAULT '{}'::jsonb;

-- Amélioration 4 — heures/jour par designer
ALTER TABLE designers
  ADD COLUMN IF NOT EXISTS workday_hours numeric(4,1) DEFAULT NULL;

-- Amélioration 7 — mode de tri par board
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS sort_mode text DEFAULT 'manual'
  CHECK (sort_mode IN ('manual', 'designer', 'template'));

-- Amélioration 8 — notes sur les assignments et les templates
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
