-- ============================================================
-- Project Tracker — Subtasks
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Run AFTER supabase-schema.sql and supabase-collaboration.sql
-- ============================================================

create table if not exists public.subtasks (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks on delete cascade not null,
  title text not null,
  status text not null default 'todo'
    check (status in ('todo', 'inprogress', 'done')),
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table public.subtasks enable row level security;

-- Select: project owner or member can read subtasks
create policy "subtasks_select" on public.subtasks
  for select using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (
        p.owner_id = auth.uid() or
        exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

-- Insert: project owner or member can add subtasks
create policy "subtasks_insert" on public.subtasks
  for insert with check (
    auth.uid() = created_by and
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (
        p.owner_id = auth.uid() or
        exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

-- Update: project owner or member can update status
create policy "subtasks_update" on public.subtasks
  for update using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (
        p.owner_id = auth.uid() or
        exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

-- Delete: creator or project owner can delete subtasks
create policy "subtasks_delete" on public.subtasks
  for delete using (
    auth.uid() = created_by or
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = auth.uid()
    )
  );

-- Enable realtime for live subtask updates
alter publication supabase_realtime add table public.subtasks;
