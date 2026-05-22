-- Fix task-project cross-tenant leakage vulnerability in Row-Level Security policies
-- Path: supabase/migrations/002_fix_rls_policies.sql

-- Drop the old overly permissive tasks CRUD policy
drop policy if exists "Allow users CRUD access to their own tasks" on public.tasks;

-- Create secure policy ensuring user can only CRUD their own tasks,
-- and cannot link a task to a project belonging to a different tenant.
create policy "Allow users CRUD access to their own tasks"
  on public.tasks
  for all
  using (
    auth.uid() = user_id
    and (project_id is null or exists (
      select 1 from public.projects
      where projects.id = project_id
      and projects.user_id = auth.uid()
    ))
  )
  with check (
    auth.uid() = user_id
    and (project_id is null or exists (
      select 1 from public.projects
      where projects.id = project_id
      and projects.user_id = auth.uid()
    ))
  );
