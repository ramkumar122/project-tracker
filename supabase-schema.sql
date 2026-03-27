-- ============================================================
-- Project Tracker — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Profiles (auto-created on signup via trigger)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- Projects
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'inprogress', 'onhold', 'done')),
  "order" integer default 0,
  project_id uuid references public.projects on delete cascade not null,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

-- Notes
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks on delete cascade not null,
  author_id uuid references auth.users not null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;

-- Profiles: anyone authenticated can read; users can only write their own
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

-- Projects: owners can do everything
create policy "projects_select" on public.projects
  for select using (auth.uid() = owner_id);

create policy "projects_insert" on public.projects
  for insert with check (auth.uid() = owner_id);

create policy "projects_update" on public.projects
  for update using (auth.uid() = owner_id);

create policy "projects_delete" on public.projects
  for delete using (auth.uid() = owner_id);

-- Tasks: members of the project can do everything
create policy "tasks_select" on public.tasks
  for select using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

create policy "tasks_insert" on public.tasks
  for insert with check (
    auth.uid() = created_by and
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

create policy "tasks_update" on public.tasks
  for update using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

create policy "tasks_delete" on public.tasks
  for delete using (
    exists (
      select 1 from public.projects
      where id = project_id and owner_id = auth.uid()
    )
  );

-- Notes: task's project owner and collaborators can read/write
create policy "notes_select" on public.notes
  for select using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = auth.uid()
    )
  );

create policy "notes_insert" on public.notes
  for insert with check (
    auth.uid() = author_id and
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Enable Realtime for live note updates
-- ============================================================

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.notes;
