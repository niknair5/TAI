const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Course {
  id: string;
  name: string;
  class_code: string;
  created_at: string;
}

export interface Guardrails {
  allow_final_answer: boolean;
  allow_code: boolean;
  max_hint_level: number;
  course_level: "elementary" | "middle" | "high" | "university";
  assessment_mode: "homework" | "quiz" | "exam" | "practice" | "unknown";
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
  chunk_index: number;
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

// Course endpoints
export async function getCourseByCode(classCode: string): Promise<Course | null> {
  const res = await fetch(`${API_URL}/api/courses/by-code/${encodeURIComponent(classCode)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch course");
  }
  return res.json();
}

export async function getCourse(courseId: string): Promise<Course> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}`);
  if (!res.ok) throw new Error("Failed to fetch course");
  return res.json();
}

export async function createCourse(name: string, classCode: string): Promise<Course> {
  const res = await fetch(`${API_URL}/api/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, class_code: classCode }),
  });
  if (!res.ok) throw new Error("Failed to create course");
  return res.json();
}

// Session endpoints
export async function createSession(courseId: string, studentId: string): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId, student_id: studentId }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

// Chat endpoint
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

// Upload endpoint
export async function uploadFile(courseId: string, file: File): Promise<{ success: boolean; chunks_created: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("course_id", courseId);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

// Guardrails endpoint
export async function getGuardrails(courseId: string): Promise<Guardrails> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/guardrails`);
  if (!res.ok) throw new Error("Failed to fetch guardrails");
  return res.json();
}

export async function updateGuardrails(courseId: string, guardrails: Partial<Guardrails>): Promise<Guardrails> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/guardrails`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guardrails),
  });
  if (!res.ok) throw new Error("Failed to update guardrails");
  return res.json();
}

// =====================================================
// User endpoints
// =====================================================

export interface User {
  id: string;
  device_id: string;
  role: "student" | "teacher";
  display_name: string | null;
  created_at: string;
}

export async function createOrGetUser(deviceId: string, role: "student" | "teacher"): Promise<User> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, role }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return res.json();
}

export async function getUserCourses(userId: string): Promise<Course[]> {
  const res = await fetch(`${API_URL}/api/users/${userId}/courses`);
  if (!res.ok) throw new Error("Failed to fetch user courses");
  return res.json();
}

export async function joinCourse(userId: string, classCode: string): Promise<Course> {
  const res = await fetch(`${API_URL}/api/users/${userId}/courses/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ class_code: classCode }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Course not found");
    throw new Error("Failed to join course");
  }
  return res.json();
}

export async function leaveCourse(userId: string, courseId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/${userId}/courses/${courseId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to leave course");
}

// =====================================================
// Course files endpoints
// =====================================================

export interface CourseFile {
  id: string;
  course_id: string;
  filename: string;
  storage_path: string;
  created_at: string;
}

export async function getCourseFiles(courseId: string): Promise<CourseFile[]> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/files`);
  if (!res.ok) throw new Error("Failed to fetch course files");
  return res.json();
}

export async function deleteCourseFile(courseId: string, fileId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/files/${fileId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete file");
}

// =====================================================
// Course activity endpoints
// =====================================================

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
  const res = await fetch(`${API_URL}/api/courses/${courseId}/activity`);
  if (!res.ok) throw new Error("Failed to fetch course activity");
  return res.json();
}
