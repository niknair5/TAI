-- =====================================================
-- TA-I Initial Database Schema
-- =====================================================
-- Run this migration in your Supabase SQL Editor
-- or using the Supabase CLI: supabase db push

-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- =====================================================
-- Courses Table
-- =====================================================
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_code text unique not null,
  created_at timestamptz default now()
);

-- Index for class code lookups
create index if not exists idx_courses_class_code on courses(class_code);

-- =====================================================
-- Course Files Table
-- =====================================================
create table if not exists course_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Index for course file lookups
create index if not exists idx_course_files_course_id on course_files(course_id);

-- =====================================================
-- Chunks Table (with embeddings)
-- =====================================================
-- Using 1536 dimensions for text-embedding-3-small
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  file_id uuid references course_files(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for course chunk lookups
create index if not exists idx_chunks_course_id on chunks(course_id);

-- IVFFlat index for vector similarity search
-- Lists = 100 is good for up to ~100k chunks per course
create index if not exists idx_chunks_embedding on chunks 
using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =====================================================
-- Chat Sessions Table
-- =====================================================
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  student_id text not null,
  created_at timestamptz default now()
);

-- Index for student session lookups
create index if not exists idx_chat_sessions_student on chat_sessions(course_id, student_id);

-- =====================================================
-- Chat Messages Table
-- =====================================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  hint_level int,
  created_at timestamptz default now()
);

-- Index for message lookups by session
create index if not exists idx_chat_messages_session on chat_messages(session_id, created_at);

-- =====================================================
-- Guardrails Table
-- =====================================================
create table if not exists guardrails (
  course_id uuid primary key references courses(id) on delete cascade,
  config jsonb not null default '{
    "allow_final_answer": false,
    "allow_code": false,
    "max_hint_level": 2,
    "course_level": "university",
    "assessment_mode": "homework"
  }'::jsonb
);

-- =====================================================
-- Vector Search Function
-- =====================================================
-- This function performs similarity search within a specific course
create or replace function match_chunks(
  query_embedding vector(1536),
  match_course_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  course_id uuid,
  file_id uuid,
  chunk_index int,
  content text,
  filename text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.course_id,
    c.file_id,
    c.chunk_index,
    c.content,
    cf.filename,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join course_files cf on c.file_id = cf.id
  where c.course_id = match_course_id
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
-- For MVP, we use service role key which bypasses RLS
-- These policies are prepared for future auth integration

-- Enable RLS on all tables
alter table courses enable row level security;
alter table course_files enable row level security;
alter table chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table guardrails enable row level security;

-- Permissive policies for service role (allows all operations)
-- These will be refined when adding proper authentication

create policy "Service role full access to courses" on courses
  for all using (true);

create policy "Service role full access to course_files" on course_files
  for all using (true);

create policy "Service role full access to chunks" on chunks
  for all using (true);

create policy "Service role full access to chat_sessions" on chat_sessions
  for all using (true);

create policy "Service role full access to chat_messages" on chat_messages
  for all using (true);

create policy "Service role full access to guardrails" on guardrails
  for all using (true);
