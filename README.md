# TA-I: AI Teaching Assistant

A RAG-based teaching assistant that helps students learn from course materials while maintaining academic integrity through a hint ladder system.

## Features

- **RAG-Only Responses**: Only answers from uploaded course materials
- **Hint Ladder System**: Progressive hints (concept → gentle hint → structured hint → worked example)
- **Academic Integrity**: Refuses direct solutions, especially during exams/quizzes
- **Instructor Guardrails**: Customizable policies per course
- **Source Citations**: Every response includes which files were used

## Tech Stack

### Frontend
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Class code authentication (localStorage)

### Backend
- FastAPI (Python)
- OpenAI API (embeddings + chat)
- Postgres + pgvector (Supabase)
- Supabase Storage for file uploads

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- OpenAI API key

### 1. Clone and Install

```bash
# Clone the repository
cd TAI

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable the pgvector extension (Database → Extensions → vector)
3. Run the migration from `supabase/migrations/001_initial_schema.sql` in the SQL Editor
4. Create a storage bucket named `course-files`
5. Copy your project URL and service role key

### 3. Configure Environment

```bash
# Backend (.env in backend folder)
cp env.template backend/.env
# Edit backend/.env with your credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - OPENAI_API_KEY

# Frontend (.env.local in frontend folder)
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

### 4. Run Development Servers

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000` to access the app.

### 5. Create a Test Course

```bash
# Create a course
curl -X POST http://localhost:8000/api/courses \
  -H "Content-Type: application/json" \
  -d '{"name": "Introduction to Physics", "class_code": "PHYS101"}'

# Upload course materials (PDF or text)
curl -X POST http://localhost:8000/api/upload \
  -F "file=@your-course-material.pdf" \
  -F "course_id=<course-id-from-above>"
```

Then join with class code `PHYS101` on the frontend.

## Project Structure

```
TAI/
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── page.tsx         # Class code join page
│   │   └── chat/[courseId]/ # Chat interface
│   ├── components/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   └── HintControls.tsx
│   └── lib/
│       └── api.ts           # Backend API client
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   └── prompts/         # System prompts
│   └── requirements.txt
└── supabase/
    └── migrations/          # Database schema
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/courses` | Create a new course |
| GET | `/api/courses/{id}` | Get course by ID |
| GET | `/api/courses/by-code/{code}` | Get course by class code |
| PUT | `/api/courses/{id}/guardrails` | Update course guardrails |
| POST | `/api/upload` | Upload and process course materials |
| POST | `/api/sessions` | Create a new chat session |
| GET | `/api/sessions/{id}/messages` | Get session message history |
| POST | `/api/chat` | Send a message and get a response |

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Set root directory to `frontend`
4. Add environment variable: `NEXT_PUBLIC_API_URL` = your Railway backend URL

### Backend (Railway)

1. Push to GitHub
2. Create new project in Railway
3. Set root directory to `backend`
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`
   - `CORS_ORIGINS` = `["https://your-vercel-url.vercel.app"]`

## Guardrails Configuration

```json
{
  "allow_final_answer": false,
  "allow_code": false,
  "max_hint_level": 2,
  "course_level": "university",
  "assessment_mode": "homework"
}
```

- **allow_final_answer**: Permit complete solutions (default: false)
- **allow_code**: Allow code in responses (default: false)
- **max_hint_level**: Maximum hint level (0-3)
- **course_level**: elementary, middle, high, university
- **assessment_mode**: homework, quiz, exam, practice, unknown

## Hint Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | Concept | Explain underlying concept, no problem-specific steps |
| 1 | Gentle | Small nudge toward approach, no calculations |
| 2 | Structured | 2-5 step plan, abstract steps only |
| 3 | Worked Example | Similar problem with different numbers |

## License

MIT
