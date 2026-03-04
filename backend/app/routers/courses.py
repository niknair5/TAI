from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from collections import Counter, defaultdict
from datetime import datetime
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


# =====================================================
# Course Analytics Endpoints
# =====================================================

# --- Response Models ---

class AnalyticsOverview(BaseModel):
    total_sessions: int
    total_messages: int
    unique_students: int
    avg_queries_per_student: float
    avg_session_depth: float


class TopicItem(BaseModel):
    topic: str
    count: int
    avg_hint_level: float
    avg_turns_to_resolve: float
    follow_up_ratio: float


class FirstTouchTopic(BaseModel):
    topic: str
    count: int


class TopicAnalysis(BaseModel):
    top_topics: list[TopicItem]
    first_touch_topics: list[FirstTouchTopic]


class SourceItem(BaseModel):
    filename: str
    reference_count: int


class CitationGap(BaseModel):
    filename: str
    unanswered_count: int


class SourceAnalysis(BaseModel):
    top_sources: list[SourceItem]
    citation_gaps: list[CitationGap]


class DifficultTopic(BaseModel):
    topic: str
    follow_up_count: int
    avg_hints: float


class DeadEndSession(BaseModel):
    session_id: str
    student_id: str
    message_count: int
    last_question: str
    created_at: datetime


class UnansweredQuestion(BaseModel):
    question: str
    created_at: datetime
    student_id: str


class StruggleSignals(BaseModel):
    difficult_topics: list[DifficultTopic]
    dead_end_sessions: list[DeadEndSession]
    unanswered_questions: list[UnansweredQuestion]


class HourlyBucket(BaseModel):
    hour: int
    count: int


class DailyBucket(BaseModel):
    day_of_week: str
    count: int


class DepthBucket(BaseModel):
    bucket: str
    count: int


class DailyActivity(BaseModel):
    date: str
    count: int


class Engagement(BaseModel):
    hourly_distribution: list[HourlyBucket]
    daily_distribution: list[DailyBucket]
    session_depth_buckets: list[DepthBucket]
    activity_over_time: list[DailyActivity]


class Cohorts(BaseModel):
    total_enrolled: int
    never_used: int
    light_users: int
    moderate_users: int
    heavy_users: int


class CourseAnalytics(BaseModel):
    overview: AnalyticsOverview
    topic_analysis: TopicAnalysis
    source_analysis: SourceAnalysis
    struggle_signals: StruggleSignals
    engagement: Engagement
    cohorts: Cohorts


# --- Helpers ---

def _parse_dt(dt_str: str) -> datetime:
    """Parse a datetime string from Supabase."""
    if not dt_str:
        return datetime.min
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except Exception:
            continue
    return datetime.min


DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


@router.get("/courses/{course_id}/analytics", response_model=CourseAnalytics)
async def get_course_analytics(course_id: UUID):
    """Comprehensive analytics dashboard data for a course."""
    supabase = get_supabase()

    # ── Fetch raw data ──────────────────────────────────
    sessions_result = supabase.table("chat_sessions").select("*").eq(
        "course_id", str(course_id)
    ).execute()
    sessions = sessions_result.data or []

    if not sessions:
        empty = CourseAnalytics(
            overview=AnalyticsOverview(
                total_sessions=0, total_messages=0, unique_students=0,
                avg_queries_per_student=0, avg_session_depth=0,
            ),
            topic_analysis=TopicAnalysis(top_topics=[], first_touch_topics=[]),
            source_analysis=SourceAnalysis(top_sources=[], citation_gaps=[]),
            struggle_signals=StruggleSignals(
                difficult_topics=[], dead_end_sessions=[], unanswered_questions=[],
            ),
            engagement=Engagement(
                hourly_distribution=[], daily_distribution=[],
                session_depth_buckets=[], activity_over_time=[],
            ),
            cohorts=Cohorts(
                total_enrolled=0, never_used=0,
                light_users=0, moderate_users=0, heavy_users=0,
            ),
        )
        return empty

    session_ids = [s["id"] for s in sessions]
    session_map: dict[str, dict] = {s["id"]: s for s in sessions}

    # Fetch messages (may need pagination for very large courses)
    messages_result = supabase.table("chat_messages").select("*").in_(
        "session_id", session_ids
    ).order("created_at").execute()
    all_messages = messages_result.data or []

    # Group messages by session
    messages_by_session: dict[str, list[dict]] = defaultdict(list)
    for m in all_messages:
        messages_by_session[m["session_id"]].append(m)

    user_messages = [m for m in all_messages if m["role"] == "user"]
    assistant_messages = [m for m in all_messages if m["role"] == "assistant"]

    unique_student_ids = list(set(s["student_id"] for s in sessions))

    # ── 1. Overview ─────────────────────────────────────
    total_sessions = len(sessions)
    total_messages = len(all_messages)
    unique_students = len(unique_student_ids)
    total_user_messages = len(user_messages)
    avg_queries = round(total_user_messages / unique_students, 1) if unique_students else 0

    session_depths = [len(msgs) for msgs in messages_by_session.values()]
    avg_depth = round(sum(session_depths) / len(session_depths), 1) if session_depths else 0

    overview = AnalyticsOverview(
        total_sessions=total_sessions,
        total_messages=total_messages,
        unique_students=unique_students,
        avg_queries_per_student=avg_queries,
        avg_session_depth=avg_depth,
    )

    # ── 2. Topic Analysis ──────────────────────────────
    topic_counter: Counter = Counter()
    topic_hints: dict[str, list[int]] = defaultdict(list)
    topic_session_turns: dict[str, list[int]] = defaultdict(list)

    for sid, msgs in messages_by_session.items():
        user_msgs_in_session = [m for m in msgs if m["role"] == "user"]
        asst_msgs_in_session = [m for m in msgs if m["role"] == "assistant"]

        # Count topics
        for um in user_msgs_in_session:
            t = um.get("topic")
            if t and t != "General":
                topic_counter[t] += 1

        # Collect hint levels per topic
        for am in asst_msgs_in_session:
            t_candidates = [um.get("topic") for um in user_msgs_in_session if um.get("topic") and um["topic"] != "General"]
            hl = am.get("hint_level")
            if hl is not None and t_candidates:
                for tc in set(t_candidates):
                    topic_hints[tc].append(hl)

        # Session turns per topic
        session_topics = set(um.get("topic") for um in user_msgs_in_session if um.get("topic") and um["topic"] != "General")
        for st in session_topics:
            topic_session_turns[st].append(len(msgs))

    top_topics: list[TopicItem] = []
    for topic, count in topic_counter.most_common(15):
        hints = topic_hints.get(topic, [])
        turns = topic_session_turns.get(topic, [])
        avg_hl = round(sum(hints) / len(hints), 2) if hints else 0
        avg_turns = round(sum(turns) / len(turns), 1) if turns else 0
        follow_up = round(count / max(len(turns), 1), 2)
        top_topics.append(TopicItem(
            topic=topic, count=count,
            avg_hint_level=avg_hl, avg_turns_to_resolve=avg_turns,
            follow_up_ratio=follow_up,
        ))

    # First-touch topics: the topic of the first user message in each session
    first_touch_counter: Counter = Counter()
    for sid, msgs in messages_by_session.items():
        first_user = next((m for m in msgs if m["role"] == "user"), None)
        if first_user and first_user.get("topic") and first_user["topic"] != "General":
            first_touch_counter[first_user["topic"]] += 1

    first_touch_topics = [
        FirstTouchTopic(topic=t, count=c)
        for t, c in first_touch_counter.most_common(10)
    ]

    topic_analysis = TopicAnalysis(top_topics=top_topics, first_touch_topics=first_touch_topics)

    # ── 3. Source Analysis ─────────────────────────────
    source_counter: Counter = Counter()
    for am in assistant_messages:
        sources = am.get("sources")
        if sources and isinstance(sources, list):
            for src in sources:
                if isinstance(src, dict) and src.get("filename"):
                    source_counter[src["filename"]] += 1

    top_sources = [
        SourceItem(filename=fn, reference_count=rc)
        for fn, rc in source_counter.most_common(10)
    ]

    # Citation gaps: files uploaded but rarely/never referenced
    # vs files referenced in refused queries
    # We track files that appear in sessions with refuse_out_of_scope
    course_files_result = supabase.table("course_files").select("filename").eq(
        "course_id", str(course_id)
    ).execute()
    uploaded_filenames = set(f["filename"] for f in (course_files_result.data or []))

    # Count how many refusals happened — these indicate content gaps
    gap_counter: Counter = Counter()
    for am in assistant_messages:
        if am.get("action") == "refuse_out_of_scope":
            # Find the user message that preceded this refusal
            sid = am["session_id"]
            session_msgs = messages_by_session.get(sid, [])
            # The user message immediately before this assistant message
            for i, sm in enumerate(session_msgs):
                if sm["id"] == am["id"] and i > 0:
                    prev = session_msgs[i - 1]
                    if prev["role"] == "user":
                        # Attribute gap to a general "content gap" bucket
                        gap_counter["Unanswered queries"] += 1
                    break

    # Also check uploaded files not referenced at all
    for fn in uploaded_filenames:
        if fn not in source_counter:
            gap_counter[fn] += 0  # Include with 0 count to flag unreferenced files

    citation_gaps = [
        CitationGap(filename=fn, unanswered_count=c)
        for fn, c in sorted(gap_counter.items(), key=lambda x: -x[1])
    ][:10]

    source_analysis = SourceAnalysis(top_sources=top_sources, citation_gaps=citation_gaps)

    # ── 4. Struggle Signals ────────────────────────────
    # Difficult topics: high hint levels + many follow-ups
    difficult_topics = sorted(
        [
            DifficultTopic(
                topic=ti.topic,
                follow_up_count=ti.count,
                avg_hints=ti.avg_hint_level,
            )
            for ti in top_topics
            if ti.avg_hint_level > 0 or ti.follow_up_ratio > 1.5
        ],
        key=lambda d: (-d.avg_hints, -d.follow_up_count),
    )[:10]

    # Dead-end sessions: high message count + last assistant was still giving hints or refusing
    dead_ends: list[DeadEndSession] = []
    for sid, msgs in messages_by_session.items():
        user_msgs_in = [m for m in msgs if m["role"] == "user"]
        asst_msgs_in = [m for m in msgs if m["role"] == "assistant"]
        if len(user_msgs_in) < 3:
            continue
        # Check if any refusal or high hint escalation
        has_refusal = any(m.get("action") == "refuse_out_of_scope" for m in asst_msgs_in)
        max_hint = max((m.get("hint_level") or 0 for m in asst_msgs_in), default=0)
        if has_refusal or max_hint >= 2:
            session_info = session_map.get(sid, {})
            last_q = user_msgs_in[-1]["content"][:120] if user_msgs_in else ""
            dead_ends.append(DeadEndSession(
                session_id=sid,
                student_id=session_info.get("student_id", ""),
                message_count=len(msgs),
                last_question=last_q,
                created_at=_parse_dt(session_info.get("created_at", "")),
            ))
    dead_ends.sort(key=lambda d: d.message_count, reverse=True)
    dead_ends = dead_ends[:10]

    # Unanswered questions
    unanswered: list[UnansweredQuestion] = []
    for am in assistant_messages:
        if am.get("action") == "refuse_out_of_scope":
            sid = am["session_id"]
            session_msgs = messages_by_session.get(sid, [])
            for i, sm in enumerate(session_msgs):
                if sm["id"] == am["id"] and i > 0:
                    prev = session_msgs[i - 1]
                    if prev["role"] == "user":
                        session_info = session_map.get(sid, {})
                        unanswered.append(UnansweredQuestion(
                            question=prev["content"][:200],
                            created_at=_parse_dt(prev.get("created_at", "")),
                            student_id=session_info.get("student_id", ""),
                        ))
                    break
    unanswered.sort(key=lambda u: u.created_at, reverse=True)
    unanswered = unanswered[:20]

    struggle_signals = StruggleSignals(
        difficult_topics=difficult_topics,
        dead_end_sessions=dead_ends,
        unanswered_questions=unanswered,
    )

    # ── 5. Engagement ──────────────────────────────────
    hourly: Counter = Counter()
    daily: Counter = Counter()
    daily_activity: Counter = Counter()

    for m in user_messages:
        dt = _parse_dt(m.get("created_at", ""))
        if dt != datetime.min:
            hourly[dt.hour] += 1
            daily[dt.weekday()] += 1
            daily_activity[dt.strftime("%Y-%m-%d")] += 1

    hourly_distribution = [
        HourlyBucket(hour=h, count=hourly.get(h, 0))
        for h in range(24)
    ]
    daily_distribution = [
        DailyBucket(day_of_week=DAY_NAMES[d], count=daily.get(d, 0))
        for d in range(7)
    ]

    # Session depth buckets
    depth_labels = [("1-2", 1, 2), ("3-5", 3, 5), ("6-10", 6, 10), ("11+", 11, 9999)]
    depth_buckets: list[DepthBucket] = []
    for label, lo, hi in depth_labels:
        cnt = sum(1 for d in session_depths if lo <= d <= hi)
        depth_buckets.append(DepthBucket(bucket=label, count=cnt))

    # Activity over time (last 30 days)
    sorted_dates = sorted(daily_activity.keys())[-30:]
    activity_over_time = [
        DailyActivity(date=d, count=daily_activity[d])
        for d in sorted_dates
    ]

    engagement = Engagement(
        hourly_distribution=hourly_distribution,
        daily_distribution=daily_distribution,
        session_depth_buckets=depth_buckets,
        activity_over_time=activity_over_time,
    )

    # ── 6. Cohorts ─────────────────────────────────────
    enrolled_result = supabase.table("user_courses").select("user_id").eq(
        "course_id", str(course_id)
    ).eq("role", "student").execute()
    enrolled_user_ids = set(r["user_id"] for r in (enrolled_result.data or []))
    total_enrolled = len(enrolled_user_ids)

    # Count sessions per student
    student_session_counts: Counter = Counter()
    for s in sessions:
        student_session_counts[s["student_id"]] += 1

    active_student_ids = set(student_session_counts.keys())
    never_used = max(0, total_enrolled - len(active_student_ids))

    light = sum(1 for c in student_session_counts.values() if c < 5)
    moderate = sum(1 for c in student_session_counts.values() if 5 <= c < 10)
    heavy = sum(1 for c in student_session_counts.values() if c >= 10)

    cohorts = Cohorts(
        total_enrolled=total_enrolled,
        never_used=never_used,
        light_users=light,
        moderate_users=moderate,
        heavy_users=heavy,
    )

    return CourseAnalytics(
        overview=overview,
        topic_analysis=topic_analysis,
        source_analysis=source_analysis,
        struggle_signals=struggle_signals,
        engagement=engagement,
        cohorts=cohorts,
    )
