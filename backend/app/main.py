from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import courses, upload, chat, me
from app.routers import auth as auth_router

settings = get_settings()

app = FastAPI(
    title="TA-I API",
    description="Teaching Assistant AI - RAG-based course assistant",
    version="0.1.0",
)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(courses.router, prefix="/api", tags=["courses"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(me.router, prefix="/api/me", tags=["me"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "tai-api"}
