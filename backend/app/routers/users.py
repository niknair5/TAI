from fastapi import APIRouter, HTTPException
from uuid import UUID
from pydantic import BaseModel
from typing import Literal
from app.db import get_supabase
from app.models import Course

router = APIRouter()


class UserCreate(BaseModel):
    device_id: str
    role: Literal["student", "teacher"]
    display_name: str | None = None


class User(BaseModel):
    id: UUID
    device_id: str
    role: Literal["student", "teacher"]
    display_name: str | None
    created_at: str


class UserWithCourses(User):
    courses: list[Course]


class JoinCourseRequest(BaseModel):
    class_code: str


@router.post("/users", response_model=User)
async def create_or_get_user(data: UserCreate):
    """Create a new user or get existing user by device_id."""
    supabase = get_supabase()
    
    # Check if user exists
    existing = supabase.table("users").select("*").eq(
        "device_id", data.device_id
    ).execute()
    
    if existing.data:
        user = existing.data[0]
        # Update role if different
        if user["role"] != data.role:
            supabase.table("users").update({"role": data.role}).eq(
                "id", user["id"]
            ).execute()
            user["role"] = data.role
        return user
    
    # Create new user
    result = supabase.table("users").insert({
        "device_id": data.device_id,
        "role": data.role,
        "display_name": data.display_name
    }).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    return result.data[0]


@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: UUID):
    """Get user by ID."""
    supabase = get_supabase()
    result = supabase.table("users").select("*").eq("id", str(user_id)).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return result.data[0]


@router.get("/users/{user_id}/courses", response_model=list[Course])
async def get_user_courses(user_id: UUID):
    """Get all courses a user belongs to."""
    supabase = get_supabase()
    
    # Get course IDs from user_courses
    memberships = supabase.table("user_courses").select(
        "course_id, role"
    ).eq("user_id", str(user_id)).execute()
    
    if not memberships.data:
        return []
    
    course_ids = [m["course_id"] for m in memberships.data]
    
    # Get course details
    courses = supabase.table("courses").select("*").in_(
        "id", course_ids
    ).execute()
    
    return courses.data or []


@router.post("/users/{user_id}/courses/join", response_model=Course)
async def join_course(user_id: UUID, data: JoinCourseRequest):
    """Join a course by class code."""
    supabase = get_supabase()
    
    # Find course by class code
    course = supabase.table("courses").select("*").eq(
        "class_code", data.class_code.upper()
    ).execute()
    
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course_data = course.data[0]
    
    # Get user role
    user = supabase.table("users").select("role").eq("id", str(user_id)).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_role = user.data[0]["role"]
    
    # Check if already a member
    existing = supabase.table("user_courses").select("*").eq(
        "user_id", str(user_id)
    ).eq("course_id", course_data["id"]).execute()
    
    if existing.data:
        # Already a member, just return the course
        return course_data
    
    # Add membership
    supabase.table("user_courses").insert({
        "user_id": str(user_id),
        "course_id": course_data["id"],
        "role": user_role
    }).execute()
    
    return course_data


@router.delete("/users/{user_id}/courses/{course_id}")
async def leave_course(user_id: UUID, course_id: UUID):
    """Leave a course."""
    supabase = get_supabase()
    
    supabase.table("user_courses").delete().eq(
        "user_id", str(user_id)
    ).eq("course_id", str(course_id)).execute()
    
    return {"success": True}
