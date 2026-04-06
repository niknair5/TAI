import { createClient } from "@/lib/supabase/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function isEduEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const i = e.indexOf("@");
  if (i < 0) return false;
  return e.slice(i + 1).endsWith(".edu");
}

export async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    const d = body.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return (
        d
          .map((x: { msg?: string }) => x.msg)
          .filter(Boolean)
          .join(", ") || "Request failed"
      );
    }
    return "Request failed";
  } catch {
    return text || "Request failed";
  }
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return session.access_token;
}

function authJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface Course {
  id: string;
  name: string;
  description: string;
  join_code: string;
  instructor_id: string;
  created_at: string;
}

export interface Guardrails {
  allow_final_answer: boolean;
  allow_code: boolean;
  allow_worked_examples: boolean;
  max_hint_level: number;
  course_level: "elementary" | "middle" | "high" | "university";
  assessment_mode: "homework" | "quiz" | "exam" | "practice" | "unknown";
  instructor_note: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  hint_level: number | null;
  created_at: string;
  sources?: Source[];
}

export interface Source {
  filename: string;
}

export interface ChatSession {
  id: string;
  course_id: string;
  student_id: string;
  created_at: string;
}

export interface ChatRequest {
  session_id: string;
  message: string;
  request_hint_increase?: boolean;
}

export interface ChatResponse {
  message: ChatMessage;
  hint_level: number;
  action: "answer" | "answer_with_integrity_refusal" | "refuse_out_of_scope";
}

export async function validateJoinCode(code: string): Promise<{ name: string } | null> {
  const normalized = code.trim().toUpperCase();
  const res = await fetch(
    `${API_URL}/api/courses/validate-join-code/${encodeURIComponent(normalized)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to validate join code");
  return res.json();
}

export async function getCourse(courseId: string): Promise<Course> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}`, {
    headers: authJsonHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch course");
  return res.json();
}

export async function createCourse(name: string, description?: string): Promise<Course> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ name, description: description ?? "" }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function getMyCourses(): Promise<Course[]> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/me/courses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export async function joinCourse(joinCode: string): Promise<Course> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/me/enroll`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ join_code: joinCode.trim().toUpperCase() }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function createSession(courseId: string, studentId: string): Promise<ChatSession> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ course_id: courseId, student_id: studentId }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function uploadFile(courseId: string, file: File): Promise<{ success: boolean; chunks_created: number }> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("course_id", courseId);
  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

export async function getGuardrails(courseId: string): Promise<Guardrails> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/guardrails`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch guardrails");
  return res.json();
}

export async function updateGuardrails(
  courseId: string,
  guardrails: Partial<Guardrails>
): Promise<Guardrails> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/guardrails`, {
    method: "PUT",
    headers: authJsonHeaders(token),
    body: JSON.stringify(guardrails),
  });
  if (!res.ok) throw new Error("Failed to update guardrails");
  return res.json();
}

export interface CourseFile {
  id: string;
  course_id: string;
  filename: string;
  storage_path: string;
  created_at: string;
}

export async function getCourseFiles(courseId: string): Promise<CourseFile[]> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch course files");
  return res.json();
}

export async function deleteCourseFile(courseId: string, fileId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete file");
}

export interface ActivityItem {
  session_id: string;
  student_id: string;
  message_count: number;
  last_message_at: string;
  hint_levels_used: number[];
  recent_questions: string[];
}

export interface CourseActivity {
  total_sessions: number;
  total_messages: number;
  unique_students: number;
  avg_hints_per_session: number;
  recent_activity: ActivityItem[];
}

export async function getCourseActivity(courseId: string): Promise<CourseActivity> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/activity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch course activity");
  return res.json();
}

export interface AnalyticsOverview {
  total_sessions: number;
  total_messages: number;
  unique_students: number;
  avg_queries_per_student: number;
  avg_session_depth: number;
}

export interface TopicItem {
  topic: string;
  count: number;
  avg_hint_level: number;
  avg_turns_to_resolve: number;
  follow_up_ratio: number;
}

export interface FirstTouchTopic {
  topic: string;
  count: number;
}

export interface TopicAnalysis {
  top_topics: TopicItem[];
  first_touch_topics: FirstTouchTopic[];
}

export interface SourceItem {
  filename: string;
  reference_count: number;
}

export interface CitationGap {
  filename: string;
  unanswered_count: number;
}

export interface SourceAnalysis {
  top_sources: SourceItem[];
  citation_gaps: CitationGap[];
}

export interface DifficultTopic {
  topic: string;
  follow_up_count: number;
  avg_hints: number;
}

export interface DeadEndSession {
  session_id: string;
  student_id: string;
  message_count: number;
  last_question: string;
  created_at: string;
}

export interface UnansweredQuestion {
  question: string;
  created_at: string;
  student_id: string;
}

export interface StruggleSignals {
  difficult_topics: DifficultTopic[];
  dead_end_sessions: DeadEndSession[];
  unanswered_questions: UnansweredQuestion[];
}

export interface HourlyBucket {
  hour: number;
  count: number;
}

export interface DailyBucket {
  day_of_week: string;
  count: number;
}

export interface DepthBucket {
  bucket: string;
  count: number;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface Engagement {
  hourly_distribution: HourlyBucket[];
  daily_distribution: DailyBucket[];
  session_depth_buckets: DepthBucket[];
  activity_over_time: DailyActivity[];
}

export interface Cohorts {
  total_enrolled: number;
  never_used: number;
  light_users: number;
  moderate_users: number;
  heavy_users: number;
}

export interface CourseAnalytics {
  overview: AnalyticsOverview;
  topic_analysis: TopicAnalysis;
  source_analysis: SourceAnalysis;
  struggle_signals: StruggleSignals;
  engagement: Engagement;
  cohorts: Cohorts;
}

export async function getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/api/courses/${courseId}/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch course analytics");
  return res.json();
}

export async function signupInstructor(
  email: string,
  password: string,
  full_name: string
): Promise<void> {
  const res = await fetch(`${API_URL}/auth/signup-instructor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      full_name: full_name.trim(),
    }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export async function signupStudent(
  email: string,
  password: string,
  full_name: string,
  join_code: string
): Promise<{ course_id?: string }> {
  const res = await fetch(`${API_URL}/auth/signup-student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      full_name: full_name.trim(),
      join_code: join_code.trim().toUpperCase(),
    }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as { course_id?: string };
}

/** Shown when fetch fails before any HTTP response (CORS, wrong URL, API down). */
export function getApiUnreachableHint(): string {
  return `Could not reach the API at ${API_URL}. For local dev, run the FastAPI backend and set NEXT_PUBLIC_API_URL=http://localhost:8000 in frontend/.env.local (restart next dev). For a hosted API, confirm /health loads, Railway is awake, and CORS_ORIGINS includes this site's origin (e.g. http://localhost:3000).`;
}

export async function loginWithBackend(email: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error(getApiUnreachableHint());
    }
    throw e;
  }
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  const supabase = createClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
}
