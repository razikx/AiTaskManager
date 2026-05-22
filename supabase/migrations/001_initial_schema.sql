-- Initial Database Schema Migration for AiTaskManager
-- Path: supabase/migrations/001_initial_schema.sql

-- Enable uuid-ossp extension for generating UUIDs
create extension if not exists "uuid-ossp";

---------------------------------------------------------
-- TABLE DEFINITIONS
---------------------------------------------------------

-- 1. Users Table (public schema, mirrors auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Projects Table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tasks Table
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date timestamp with time zone,
  priority_score integer default 0 not null,
  status text default 'todo' not null check (status in ('todo', 'in_progress', 'completed')),
  project_id uuid references public.projects on delete cascade,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Subtasks Table
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks on delete cascade not null,
  title text not null,
  is_completed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

---------------------------------------------------------
-- INDEXES FOR PERFORMANCE & INTEGRITY
---------------------------------------------------------

create index idx_projects_user_id on public.projects(user_id);
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_tasks_project_id on public.tasks(project_id);
create index idx_subtasks_task_id on public.subtasks(task_id);

---------------------------------------------------------
-- AUTOMATED AUTH MIRRORING TRIGGER
---------------------------------------------------------

-- Function to handle new user insertion from auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to execute the function on auth.users inserts
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

---------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
---------------------------------------------------------

-- Enable Row-Level Security on all tables
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

-- Policies for users table
create policy "Allow user access to their own user record"
  on public.users
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policies for projects table
create policy "Allow users CRUD access to their own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for tasks table
create policy "Allow users CRUD access to their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for subtasks table
create policy "Allow users CRUD access to subtasks of their own tasks"
  on public.subtasks
  for all
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = subtasks.task_id
      and tasks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = subtasks.task_id
      and tasks.user_id = auth.uid()
    )
  );

---------------------------------------------------------
-- ENABLE REALTIME FOR TABLES
---------------------------------------------------------

-- Create the supabase_realtime publication if it doesn't exist (Supabase managed, but good for local/Docker testing)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
exception
  when others then null;
end $$;

-- Add tables to the realtime publication
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.subtasks;

