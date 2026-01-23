# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (takes ~2 minutes)
3. Note your project URL and service role key from Settings > API

## 2. Enable pgvector Extension

The migration script enables pgvector automatically, but if needed:

1. Go to Database > Extensions in your Supabase dashboard
2. Search for "vector"
3. Enable the extension

## 3. Run the Migration

### Option A: Supabase Dashboard (Recommended for MVP)

1. Go to SQL Editor in your Supabase dashboard
2. Create a new query
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Run the query

### Option B: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## 4. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `course-files`
3. Set it as a private bucket (not public)

## 5. Get Your Credentials

From Settings > API, copy:

- **Project URL**: `https://xxxxx.supabase.co`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

Add these to your `.env` file:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

## Database Schema Overview

```
courses
├── id (uuid, primary key)
├── name (text)
├── class_code (text, unique)
└── created_at (timestamp)

course_files
├── id (uuid, primary key)
├── course_id (foreign key → courses)
├── filename (text)
├── storage_path (text)
└── created_at (timestamp)

chunks
├── id (uuid, primary key)
├── course_id (foreign key → courses)
├── file_id (foreign key → course_files)
├── chunk_index (int)
├── content (text)
├── embedding (vector(1536))
└── created_at (timestamp)

chat_sessions
├── id (uuid, primary key)
├── course_id (foreign key → courses)
├── student_id (text)
└── created_at (timestamp)

chat_messages
├── id (uuid, primary key)
├── session_id (foreign key → chat_sessions)
├── role (text: 'user' | 'assistant')
├── content (text)
├── hint_level (int, nullable)
└── created_at (timestamp)

guardrails
├── course_id (uuid, primary key, foreign key → courses)
└── config (jsonb)
```

## Vector Search Function

The `match_chunks` function performs similarity search:

```sql
select * from match_chunks(
  query_embedding := '[0.1, 0.2, ...]'::vector,
  match_course_id := 'uuid-here',
  match_count := 5
);
```

Returns: `id`, `course_id`, `file_id`, `chunk_index`, `content`, `filename`, `similarity`
