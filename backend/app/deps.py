from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, Header

from app.config import get_settings
from app.db import get_supabase


async def get_current_user_id(
    authorization: str | None = Header(None, alias="Authorization"),
) -> UUID:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
            )
    except httpx.RequestError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        uid = r.json().get("id")
        if not uid:
            raise ValueError("no id")
        return UUID(uid)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_profile(
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    supabase = get_supabase()
    row = (
        supabase.table("users")
        .select("id, email, role, full_name, created_at")
        .eq("id", str(user_id))
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="User profile not found")
    return row.data[0]
