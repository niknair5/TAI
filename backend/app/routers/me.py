from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth_utils import is_valid_join_code_format, normalize_join_code
from app.db import get_supabase
from app.deps import get_current_profile
from app.models import Course

router = APIRouter()


class EnrollBody(BaseModel):
    join_code: str = Field(min_length=1, max_length=32)


@router.get("/courses", response_model=list[Course])
async def list_my_courses(profile: dict = Depends(get_current_profile)):
    supabase = get_supabase()
    uid = str(profile["id"])
    if profile["role"] == "instructor":
        result = (
            supabase.table("courses")
            .select("*")
            .eq("instructor_id", uid)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    if profile["role"] == "student":
        enr = (
            supabase.table("enrollments")
            .select("course_id")
            .eq("student_id", uid)
            .execute()
        )
        if not enr.data:
            return []
        ids = [e["course_id"] for e in enr.data]
        courses = supabase.table("courses").select("*").in_("id", ids).execute()
        return courses.data or []
    raise HTTPException(status_code=403, detail="Invalid role")


@router.get("/enrollment/{course_id}")
async def check_enrollment(
    course_id: UUID,
    profile: dict = Depends(get_current_profile),
):
    """Returns 200 if the current student is enrolled in the course."""
    if profile["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have enrollments")
    supabase = get_supabase()
    row = (
        supabase.table("enrollments")
        .select("id")
        .eq("course_id", str(course_id))
        .eq("student_id", str(profile["id"]))
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    return {"enrolled": True}


@router.post("/enroll", response_model=Course)
async def enroll_in_course(
    body: EnrollBody,
    profile: dict = Depends(get_current_profile),
):
    """Let an existing student join a new course by join code."""
    if profile["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll")

    code = normalize_join_code(body.join_code)
    if not is_valid_join_code_format(code):
        raise HTTPException(
            status_code=400,
            detail="Join code must be exactly 8 characters (letters and numbers, excluding 0, O, 1, I, L)",
        )

    supabase = get_supabase()
    result = supabase.table("courses").select("*").eq("join_code", code).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid join code")

    course = result.data[0]
    uid = str(profile["id"])

    try:
        supabase.table("enrollments").insert(
            {"student_id": uid, "course_id": course["id"]}
        ).execute()
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="You are already enrolled in this course")
        raise HTTPException(status_code=500, detail="Could not enroll")

    return course
