-- ============================================================
-- Collaboration Migration — Run AFTER supabase-schema.sql
-- Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Project members table
create table if not exists public.project_members (
  project_id uuid references public.projects on delete cascade not null,
  user_id    uuid references auth.users on delete cascade not null,
  invited_by uuid references auth.users not null,
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);

alter table public.project_members enable row level security;

-- Note: must NOT reference projects table here — that would cause infinite recursion
-- (projects_select references project_members, project_members_select references projects)
create policy "members_select" on public.project_members
  for select using (
    auth.uid() = user_id or auth.uid() = invited_by
  );

create policy "members_insert" on public.project_members
  for insert with check (
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );

create policy "members_delete" on public.project_members
  for delete using (
    auth.uid() = user_id or
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );

-- ============================================================
-- Update project policy: members can also see the project
-- ============================================================
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (
    auth.uid() = owner_id or
    exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
  );

-- ============================================================
-- Update task policies: members can create/read/update/delete
-- ============================================================
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;

create policy "tasks_select" on public.tasks
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

create policy "tasks_insert" on public.tasks
  for insert with check (
    auth.uid() = created_by and
    exists (
      select 1 from public.projects p
      where p.id = project_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

create policy "tasks_update" on public.tasks
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

create policy "tasks_delete" on public.tasks
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

-- ============================================================
-- Update notes policies: members can read/write notes
-- ============================================================
drop policy if exists "notes_select" on public.notes;
drop policy if exists "notes_insert" on public.notes;

create policy "notes_select" on public.notes
  for select using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

create policy "notes_insert" on public.notes
  for insert with check (
    auth.uid() = author_id and
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (
        p.owner_id = auth.uid() or
        exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
      )
    )
  );

-- Enable realtime for project_members
alter publication supabase_realtime add table public.project_members;
