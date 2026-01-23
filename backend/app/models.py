from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal
from uuid import UUID


# === Course Models ===

class CourseCreate(BaseModel):
    name: str
    class_code: str


class Course(BaseModel):
    id: UUID
    name: str
    class_code: str
    created_at: datetime


# === Guardrails Models ===

class Guardrails(BaseModel):
    allow_final_answer: bool = False
    allow_code: bool = False
    max_hint_level: int = Field(default=2, ge=0, le=3)
    course_level: Literal["elementary", "middle", "high", "university"] = "university"
    assessment_mode: Literal["homework", "quiz", "exam", "practice", "unknown"] = "homework"


class GuardrailsUpdate(BaseModel):
    allow_final_answer: bool | None = None
    allow_code: bool | None = None
    max_hint_level: int | None = Field(default=None, ge=0, le=3)
    course_level: Literal["elementary", "middle", "high", "university"] | None = None
    assessment_mode: Literal["homework", "quiz", "exam", "practice", "unknown"] | None = None


# === Session Models ===

class SessionCreate(BaseModel):
    course_id: UUID
    student_id: str


class Session(BaseModel):
    id: UUID
    course_id: UUID
    student_id: str
    created_at: datetime


# === Message Models ===

class Source(BaseModel):
    filename: str
    chunk_index: int


class ChatMessage(BaseModel):
    id: UUID
    session_id: UUID
    role: Literal["user", "assistant"]
    content: str
    hint_level: int | None = None
    created_at: datetime
    sources: list[Source] | None = None


class ChatRequest(BaseModel):
    session_id: UUID
    message: str
    request_hint_increase: bool = False


class ChatResponse(BaseModel):
    message: ChatMessage
    hint_level: int
    action: Literal["answer", "answer_with_integrity_refusal", "refuse_out_of_scope"]


# === Chunk/Retrieval Models ===

class Chunk(BaseModel):
    id: UUID
    course_id: UUID
    file_id: UUID
    chunk_index: int
    content: str
    created_at: datetime


class Excerpt(BaseModel):
    filename: str
    chunk_index: int
    content: str
    similarity: float


class RetrievalRequest(BaseModel):
    course_id: UUID
    query: str


class RetrievalResponse(BaseModel):
    excerpts: list[Excerpt]


# === Upload Models ===

class UploadResponse(BaseModel):
    success: bool
    filename: str
    chunks_created: int


# === Hint Controller Models ===

class HintState(BaseModel):
    hint_level_used: int = 0
    number_of_hints_given: int = 0


class HintControllerInput(BaseModel):
    student_message: str
    guardrails: Guardrails
    hint_state: HintState
    excerpt_hit_count: int


class HintControllerOutput(BaseModel):
    action: Literal["answer", "answer_with_integrity_refusal", "refuse_out_of_scope"]
    hint_level: int = Field(ge=0, le=3)
    notes_for_assistant: str
