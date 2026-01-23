from fastapi import APIRouter, HTTPException
from uuid import UUID
from app.db import get_supabase
from app.models import Course, CourseCreate, Guardrails, GuardrailsUpdate, Session, SessionCreate, ChatMessage

router = APIRouter()


@router.post("/courses", response_model=Course)
async def create_course(data: CourseCreate):
    """Create a new course with default guardrails."""
    supabase = get_supabase()
    
    # Check if class code already exists
    existing = supabase.table("courses").select("id").eq("class_code", data.class_code.upper()).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Class code already exists")
    
    # Create course
    result = supabase.table("courses").insert({
        "name": data.name,
        "class_code": data.class_code.upper()
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create course")
    
    course = result.data[0]
    
    # Create default guardrails
    supabase.table("guardrails").insert({
        "course_id": course["id"],
        "config": Guardrails().model_dump()
    }).execute()
    
    return course


@router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: UUID):
    """Get a course by ID."""
    supabase = get_supabase()
    result = supabase.table("courses").select("*").eq("id", str(course_id)).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return result.data[0]


@router.get("/courses/by-code/{class_code}", response_model=Course)
async def get_course_by_code(class_code: str):
    """Get a course by class code."""
    supabase = get_supabase()
    result = supabase.table("courses").select("*").eq("class_code", class_code.upper()).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return result.data[0]


@router.get("/courses/{course_id}/guardrails", response_model=Guardrails)
async def get_guardrails(course_id: UUID):
    """Get guardrails for a course."""
    supabase = get_supabase()
    result = supabase.table("guardrails").select("config").eq("course_id", str(course_id)).execute()
    
    if not result.data:
        # Return defaults if not found
        return Guardrails()
    
    return Guardrails(**result.data[0]["config"])


@router.put("/courses/{course_id}/guardrails", response_model=Guardrails)
async def update_guardrails(course_id: UUID, data: GuardrailsUpdate):
    """Update guardrails for a course."""
    supabase = get_supabase()
    
    # Get current guardrails
    current = await get_guardrails(course_id)
    
    # Merge updates
    updated = current.model_dump()
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            updated[key] = value
    
    # Upsert guardrails
    supabase.table("guardrails").upsert({
        "course_id": str(course_id),
        "config": updated
    }).execute()
    
    return Guardrails(**updated)


@router.post("/sessions", response_model=Session)
async def create_session(data: SessionCreate):
    """Create a new chat session."""
    supabase = get_supabase()
    
    result = supabase.table("chat_sessions").insert({
        "course_id": str(data.course_id),
        "student_id": data.student_id
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    
    return result.data[0]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessage])
async def get_session_messages(session_id: UUID):
    """Get all messages in a session."""
    supabase = get_supabase()
    
    result = supabase.table("chat_messages").select("*").eq(
        "session_id", str(session_id)
    ).order("created_at").execute()
    
    return result.data or []


# =====================================================
# Course Files Endpoints
# =====================================================

from pydantic import BaseModel
from datetime import datetime


class CourseFile(BaseModel):
    id: UUID
    course_id: UUID
    filename: str
    storage_path: str
    created_at: datetime


@router.get("/courses/{course_id}/files", response_model=list[CourseFile])
async def get_course_files(course_id: UUID):
    """Get all files uploaded to a course."""
    supabase = get_supabase()
    
    result = supabase.table("course_files").select("*").eq(
        "course_id", str(course_id)
    ).order("created_at", desc=True).execute()
    
    return result.data or []


@router.delete("/courses/{course_id}/files/{file_id}")
async def delete_course_file(course_id: UUID, file_id: UUID):
    """Delete a file and its chunks from a course."""
    supabase = get_supabase()
    
    # Get file info
    file_result = supabase.table("course_files").select("*").eq(
        "id", str(file_id)
    ).eq("course_id", str(course_id)).execute()
    
    if not file_result.data:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_data = file_result.data[0]
    
    # Delete chunks first (cascade should handle this, but be explicit)
    supabase.table("chunks").delete().eq("file_id", str(file_id)).execute()
    
    # Delete file record
    supabase.table("course_files").delete().eq("id", str(file_id)).execute()
    
    # Delete from storage
    try:
        supabase.storage.from_("course-files").remove([file_data["storage_path"]])
    except Exception:
        pass  # Storage deletion is best-effort
    
    return {"success": True, "deleted_file": file_data["filename"]}


# =====================================================
# Course Activity Endpoints
# =====================================================

class ActivityItem(BaseModel):
    session_id: UUID
    student_id: str
    message_count: int
    last_message_at: datetime
    hint_levels_used: list[int]
    recent_questions: list[str]


class CourseActivity(BaseModel):
    total_sessions: int
    total_messages: int
    unique_students: int
    avg_hints_per_session: float
    recent_activity: list[ActivityItem]


@router.get("/courses/{course_id}/activity", response_model=CourseActivity)
async def get_course_activity(course_id: UUID):
    """Get student activity logs for a course."""
    supabase = get_supabase()
    
    # Get all sessions for this course
    sessions = supabase.table("chat_sessions").select("*").eq(
        "course_id", str(course_id)
    ).execute()
    
    if not sessions.data:
        return CourseActivity(
            total_sessions=0,
            total_messages=0,
            unique_students=0,
            avg_hints_per_session=0.0,
            recent_activity=[]
        )
    
    session_ids = [s["id"] for s in sessions.data]
    student_ids = list(set(s["student_id"] for s in sessions.data))
    
    # Get all messages for these sessions
    messages = supabase.table("chat_messages").select("*").in_(
        "session_id", session_ids
    ).order("created_at", desc=True).execute()
    
    all_messages = messages.data or []
    
    # Calculate stats
    total_messages = len(all_messages)
    hint_levels = [m["hint_level"] for m in all_messages if m["hint_level"] is not None]
    avg_hints = sum(hint_levels) / len(session_ids) if session_ids else 0.0
    
    # Build activity items per session
    activity_items = []
    for session in sessions.data[:10]:  # Limit to 10 recent sessions
        session_messages = [m for m in all_messages if m["session_id"] == session["id"]]
        user_messages = [m for m in session_messages if m["role"] == "user"]
        
        if session_messages:
            activity_items.append(ActivityItem(
                session_id=session["id"],
                student_id=session["student_id"],
                message_count=len(session_messages),
                last_message_at=session_messages[0]["created_at"] if session_messages else session["created_at"],
                hint_levels_used=list(set(
                    m["hint_level"] for m in session_messages 
                    if m["hint_level"] is not None
                )),
                recent_questions=[m["content"][:100] for m in user_messages[:3]]
            ))
    
    return CourseActivity(
        total_sessions=len(sessions.data),
        total_messages=total_messages,
        unique_students=len(student_ids),
        avg_hints_per_session=round(avg_hints, 2),
        recent_activity=activity_items
    )
