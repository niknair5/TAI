from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import courses, upload, chat, users

settings = get_settings()

app = FastAPI(
    title="TA-I API",
    description="Teaching Assistant AI - RAG-based course assistant",
    version="0.1.0",
)

# CORS middleware - allow all origins for now
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(courses.router, prefix="/api", tags=["courses"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(users.router, prefix="/api", tags=["users"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "tai-api"}
