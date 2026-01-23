-- =====================================================
-- TA-I Users and Course Memberships
-- =====================================================
-- Run this migration after 001_initial_schema.sql

-- =====================================================
-- Users Table
-- =====================================================
-- Stores users with their role (student/teacher) and device ID
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  device_id text unique not null,
  role text not null check (role in ('student', 'teacher')),
  display_name text,
  created_at timestamptz default now()
);

-- Index for device_id lookups
create index if not exists idx_users_device_id on users(device_id);

-- =====================================================
-- User-Course Memberships Table
-- =====================================================
-- Tracks which users belong to which courses
create table if not exists user_courses (
  user_id uuid references users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  joined_at timestamptz default now(),
  primary key (user_id, course_id)
);

-- Index for user's courses lookup
create index if not exists idx_user_courses_user on user_courses(user_id);
create index if not exists idx_user_courses_course on user_courses(course_id);

-- =====================================================
-- Add creator to courses table
-- =====================================================
alter table courses add column if not exists created_by uuid references users(id);

-- =====================================================
-- Row Level Security Policies
-- =====================================================
alter table users enable row level security;
alter table user_courses enable row level security;

create policy "Service role full access to users" on users
  for all using (true);

create policy "Service role full access to user_courses" on user_courses
  for all using (true);
