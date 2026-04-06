-- =====================================================
-- TA-I Phase 1: Supabase Auth, join codes, enrollments
-- =====================================================
-- Destructive: truncates courses (and dependent RAG/chat data).
-- Backup before applying if you need existing data.

-- ------------------------------------------------------------
-- Drop legacy membership and users (device_id model)
-- ------------------------------------------------------------
drop policy if exists "Service role full access to user_courses" on user_courses;
drop policy if exists "Service role full access to users" on users;

drop table if exists user_courses cascade;

alter table if exists courses drop constraint if exists courses_created_by_fkey;
alter table if exists courses drop column if exists created_by;

drop table if exists users cascade;

-- ------------------------------------------------------------
-- New users profile (1:1 with auth.users)
-- ------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('instructor', 'student')),
  full_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select to authenticated
  using (id = auth.uid());

create policy "users_update_own" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- Reset courses + dependents, then reshape courses
-- ------------------------------------------------------------
truncate table courses cascade;

drop index if exists idx_courses_class_code;

alter table courses drop column if exists class_code;

alter table courses
  add column if not exists instructor_id uuid references public.users (id) on delete cascade,
  add column if not exists description text default '' not null,
  add column if not exists join_code text;

-- Empty table after TRUNCATE: enforce NOT NULL for new rows
alter table courses alter column join_code set not null;
alter table courses alter column instructor_id set not null;

create unique index if not exists idx_courses_join_code on courses (join_code);
create index if not exists idx_courses_instructor_id on courses (instructor_id);

-- ------------------------------------------------------------
-- Enrollments
-- ------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index if not exists idx_enrollments_student on public.enrollments (student_id);
create index if not exists idx_enrollments_course on public.enrollments (course_id);

alter table public.enrollments enable row level security;

create policy "enrollments_select" on public.enrollments
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from courses c
      where c.id = enrollments.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "enrollments_insert_self" on public.enrollments
  for insert to authenticated
  with check (student_id = auth.uid());

-- ------------------------------------------------------------
-- Replace permissive RLS on core TA-I tables
-- ------------------------------------------------------------
drop policy if exists "Service role full access to courses" on courses;
drop policy if exists "Service role full access to course_files" on course_files;
drop policy if exists "Service role full access to chunks" on chunks;
drop policy if exists "Service role full access to chat_sessions" on chat_sessions;
drop policy if exists "Service role full access to chat_messages" on chat_messages;
drop policy if exists "Service role full access to guardrails" on guardrails;

-- Courses
create policy "courses_select_member" on courses
  for select to authenticated
  using (
    instructor_id = auth.uid()
    or exists (
      select 1 from public.enrollments e
      where e.course_id = courses.id
        and e.student_id = auth.uid()
    )
  );

create policy "courses_insert_instructor" on courses
  for insert to authenticated
  with check (instructor_id = auth.uid());

create policy "courses_update_instructor" on courses
  for update to authenticated
  using (instructor_id = auth.uid())
  with check (instructor_id = auth.uid());

create policy "courses_delete_instructor" on courses
  for delete to authenticated
  using (instructor_id = auth.uid());

-- Course files (instructor CRUD; enrolled students read)
create policy "course_files_instructor_all" on course_files
  for all to authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = course_files.course_id
        and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = course_files.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "course_files_student_select" on course_files
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = course_files.course_id
        and e.student_id = auth.uid()
    )
  );

-- Chunks
create policy "chunks_instructor_all" on chunks
  for all to authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = chunks.course_id
        and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = chunks.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "chunks_student_select" on chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = chunks.course_id
        and e.student_id = auth.uid()
    )
  );

-- Guardrails
create policy "guardrails_instructor_all" on guardrails
  for all to authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = guardrails.course_id
        and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = guardrails.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "guardrails_student_select" on guardrails
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = guardrails.course_id
        and e.student_id = auth.uid()
    )
  );

-- Chat sessions (student_id stored as text = auth user uuid)
create policy "chat_sessions_select" on chat_sessions
  for select to authenticated
  using (
    student_id = (auth.uid())::text
    or exists (
      select 1 from courses c
      where c.id = chat_sessions.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "chat_sessions_insert_student" on chat_sessions
  for insert to authenticated
  with check (
    student_id = (auth.uid())::text
    and exists (
      select 1 from public.enrollments e
      where e.course_id = chat_sessions.course_id
        and e.student_id = auth.uid()
    )
  );

-- Chat messages
create policy "chat_messages_select" on chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from chat_sessions s
      where s.id = chat_messages.session_id
        and (
          s.student_id = (auth.uid())::text
          or exists (
            select 1 from courses c
            where c.id = s.course_id
              and c.instructor_id = auth.uid()
          )
        )
    )
  );

create policy "chat_messages_insert_student" on chat_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from chat_sessions s
      where s.id = chat_messages.session_id
        and s.student_id = (auth.uid())::text
    )
  );
