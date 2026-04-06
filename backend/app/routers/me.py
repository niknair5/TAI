from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_supabase
from app.deps import get_current_profile
from app.models import Course

router = APIRouter()


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
