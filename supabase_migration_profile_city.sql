-- ============================================================
-- KidQueue — ensure city/province columns exist on profiles
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

alter table public.profiles
  add column if not exists city text default null,
  add column if not exists province text default null;
