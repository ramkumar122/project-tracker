-- ============================================================
-- Project Tracker — Due Dates
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Run AFTER supabase-schema.sql
-- ============================================================

-- Add due_date to tasks
alter table public.tasks
  add column if not exists due_date date;

-- Add due_date to projects
alter table public.projects
  add column if not exists due_date date;
