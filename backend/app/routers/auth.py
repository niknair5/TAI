from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth_utils import is_edu_email, is_valid_join_code_format, normalize_join_code
from app.config import get_settings
from app.db import get_supabase
from app.deps import get_current_profile

router = APIRouter()


class SignupInstructorBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)


class SignupStudentBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    join_code: str = Field(min_length=1, max_length=32)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class MeResponse(BaseModel):
    id: UUID
    email: str
    role: str
    full_name: str | None
    created_at: str


def _map_auth_error_message(msg: str | None, default: str) -> str:
    if not msg:
        return default
    lower = msg.lower()
    if "already" in lower or "registered" in lower or "exists" in lower:
        return "This email is already registered"
    if "password" in lower and "invalid" in lower:
        return "Wrong password"
    if "invalid login" in lower or "invalid credentials" in lower:
        return "Wrong password"
    return msg


@router.post("/signup-instructor")
async def signup_instructor(data: SignupInstructorBody):
    email = data.email.strip().lower()
    if not is_edu_email(email):
        raise HTTPException(status_code=400, detail="Email must be a .edu address")

    client = get_supabase()
    user_id = None
    try:
        auth_res = client.auth.admin.create_user(
            {
                "email": email,
                "password": data.password,
                "email_confirm": True,
            }
        )
        if not auth_res.user:
            raise HTTPException(status_code=500, detail="Failed to create account")
        user_id = auth_res.user.id
        ins = (
            client.table("users")
            .insert(
                {
                    "id": str(user_id),
                    "email": email,
                    "role": "instructor",
                    "full_name": data.full_name.strip(),
                }
            )
            .execute()
        )
        if not ins.data:
            raise RuntimeError("profile insert failed")
    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if user_id:
            try:
                client.auth.admin.delete_user(user_id)
            except Exception:
                pass
        if "already been registered" in err_text.lower() or "user already registered" in err_text.lower():
            raise HTTPException(status_code=409, detail="This email is already registered")
        if "duplicate key" in err_text.lower() or "unique constraint" in err_text.lower():
            raise HTTPException(status_code=409, detail="This email is already registered")
        raise HTTPException(
            status_code=400, detail=_map_auth_error_message(err_text, "Could not create account")
        )

    return {"message": "Account created", "user_id": user_id}


@router.post("/signup-student")
async def signup_student(data: SignupStudentBody):
    email = data.email.strip().lower()
    if not is_edu_email(email):
        raise HTTPException(status_code=400, detail="Email must be a .edu address")

    code = normalize_join_code(data.join_code)
    if not is_valid_join_code_format(code):
        raise HTTPException(
            status_code=400,
            detail="Join code must be exactly 8 characters (letters and numbers, excluding 0, O, 1, I, L)",
        )

    client = get_supabase()
    course = client.table("courses").select("id").eq("join_code", code).execute()
    if not course.data:
        raise HTTPException(status_code=404, detail="Invalid join code")

    course_id = course.data[0]["id"]
    user_id = None
    try:
        auth_res = client.auth.admin.create_user(
            {
                "email": email,
                "password": data.password,
                "email_confirm": True,
            }
        )
        if not auth_res.user:
            raise HTTPException(status_code=500, detail="Failed to create account")
        user_id = auth_res.user.id

        client.table("users").insert(
            {
                "id": str(user_id),
                "email": email,
                "role": "student",
                "full_name": data.full_name.strip(),
            }
        ).execute()

        client.table("enrollments").insert(
            {"student_id": str(user_id), "course_id": str(course_id)}
        ).execute()
    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if user_id:
            try:
                client.auth.admin.delete_user(user_id)
            except Exception:
                pass
        if "already been registered" in err_text.lower() or "user already registered" in err_text.lower():
            raise HTTPException(status_code=409, detail="This email is already registered")
        if "duplicate key" in err_text.lower() or "unique constraint" in err_text.lower():
            if "enrollments" in err_text.lower():
                raise HTTPException(
                    status_code=409, detail="You are already enrolled in this course"
                )
            raise HTTPException(status_code=409, detail="This email is already registered")
        raise HTTPException(status_code=400, detail=_map_auth_error_message(err_text, "Could not create account"))

    return {"message": "Account created", "user_id": user_id, "course_id": course_id}


@router.post("/login")
async def login(data: LoginBody):
    email = data.email.strip().lower()
    if not is_edu_email(email):
        raise HTTPException(status_code=400, detail="Email must be a .edu address")

    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    try:
        with httpx.Client(timeout=30.0) as http:
            r = http.post(
                url,
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                    "Content-Type": "application/json",
                },
                json={"email": email, "password": data.password},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    if r.status_code != 200:
        try:
            body = r.json()
            msg = body.get("error_description") or body.get("msg") or body.get("message") or ""
        except Exception:
            msg = r.text or ""
        if r.status_code in (400, 401):
            raise HTTPException(
                status_code=401,
                detail=_map_auth_error_message(msg, "Wrong password"),
            )
        raise HTTPException(
            status_code=400,
            detail=_map_auth_error_message(msg, "Could not sign in"),
        )

    tokens = r.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Invalid auth response")

    client = get_supabase()
    try:
        u = client.auth.get_user(access_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not u or not u.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    profile = (
        client.table("users")
        .select("role")
        .eq("id", u.user.id)
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    role = profile.data[0]["role"]
    return {
        "access_token": access_token,
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": tokens.get("expires_in"),
        "expires_at": tokens.get("expires_at"),
        "token_type": tokens.get("token_type", "bearer"),
        "user": {"id": u.user.id, "email": u.user.email},
        "role": role,
    }


@router.get("/me", response_model=MeResponse)
async def me(profile: dict = Depends(get_current_profile)):
    return MeResponse(
        id=UUID(profile["id"]),
        email=profile["email"],
        role=profile["role"],
        full_name=profile.get("full_name"),
        created_at=profile["created_at"],
    )
