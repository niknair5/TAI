"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, FileText, Settings, BarChart3, Upload, Trash2,
  Copy, Check, AlertTriangle, HelpCircle, Clock, Users, TrendingUp,
  BookOpen, MessageSquare, Flame,
} from "lucide-react";
import { getStoredRole, getStoredUserId } from "@/lib/utils";
import {
  getCourse, getCourseFiles, deleteCourseFile, uploadFile,
  getGuardrails, updateGuardrails, getCourseAnalytics,
  Course, CourseFile, Guardrails, CourseAnalytics,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie,
} from "recharts";

// ─── Design tokens for recharts ─────────────────────
const BLUE = "#1A3A6B";
const BLUE_MID = "#2A5298";
const BLUE_LIGHT = "#EBF1FA";
const ACCENT = "#E8601C";
const ACCENT_SOFT = "#F9DDD0";
const INK_30 = "rgba(13,17,23,0.3)";

type Tab = "files" | "guardrails" | "analytics";

// ─── Recharts custom tooltip ────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-lg px-3 py-1.5 shadow-md text-xs">
      <p className="font-medium text-tai-blue">{label}</p>
      <p className="text-ink/60">{payload[0].value}</p>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────
function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-tai-accent" />
        <div>
          <h3 className="font-medium text-sm text-tai-blue leading-none">{title}</h3>
          <p className="text-xs text-ink/40 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Calendar Heatmap (replaces hour / day-of-week charts) ──
function CalendarHeatmap({ data }: { data: { date: string; count: number }[] }) {
  // Build a lookup map: "YYYY-MM-DD" → count
  const lookup = new Map(data.map((d) => [d.date, d.count]));
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Determine which months to show (derive from data, fall back to current)
  const allDates = data.map((d) => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const months: Date[] = [];
  if (allDates.length > 0) {
    // Show distinct months that appear in the data (up to 3)
    const seen = new Set<string>();
    for (const d of allDates) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) { seen.add(key); months.push(new Date(d.getFullYear(), d.getMonth(), 1)); }
    }
    // If only one month, add the next month too for context
    if (months.length === 1) {
      const m = months[0];
      const prev = new Date(m.getFullYear(), m.getMonth() - 1, 1);
      if (prev < m) months.unshift(prev);
    }
  } else {
    months.push(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    months.push(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  // Keep last 3 months max
  const displayMonths = months.slice(-3);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function colorForCount(count: number): string {
    if (count === 0) return "#F3F4F6"; // gray-100
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "#DBEAFE"; // blue-100
    if (ratio <= 0.5) return "#93C5FD";  // blue-300
    if (ratio <= 0.75) return "#3B82F6"; // blue-500
    return BLUE;                          // tai-blue
  }

  function buildMonthGrid(monthStart: Date) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // getDay(): 0=Sun, we want 0=Mon  →  (getDay()+6)%7
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells: { day: number | null; count: number; dateStr: string }[] = [];
    // Leading blanks
    for (let i = 0; i < firstDayOffset; i++) cells.push({ day: null, count: 0, dateStr: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, count: lookup.get(dateStr) || 0, dateStr });
    }
    return cells;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-8">
        {displayMonths.map((m) => {
          const grid = buildMonthGrid(m);
          const monthLabel = m.toLocaleString("default", { month: "long", year: "numeric" });
          return (
            <div key={monthLabel} className="flex-1 min-w-[260px]">
              <p className="text-xs font-medium text-tai-blue mb-2">{monthLabel}</p>
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
                {dayLabels.map((dl) => (
                  <div key={dl} className="text-[9px] text-ink/30 text-center font-mono">{dl}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-[3px]">
                {grid.map((cell, idx) => (
                  <div
                    key={idx}
                    title={cell.day ? `${cell.dateStr}: ${cell.count} messages` : ""}
                    className={cn(
                      "aspect-square rounded-[3px] text-[9px] flex items-center justify-center transition-colors",
                      cell.day ? "cursor-default" : "",
                    )}
                    style={{ backgroundColor: cell.day ? colorForCount(cell.count) : "transparent" }}
                  >
                    {cell.day && cell.count > 0 && (
                      <span className={cn("font-mono", cell.count / maxCount > 0.5 ? "text-white/80" : "text-ink/40")}>
                        {cell.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px] text-ink/30 mr-1">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <div key={r} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: colorForCount(r === 0 ? 0 : Math.ceil(r * maxCount)) }} />
        ))}
        <span className="text-[10px] text-ink/30 ml-1">More</span>
      </div>
    </div>
  );
}

// ─── Horizontal bar (CSS-based, for ranked lists) ───
function HorizontalBar({ label, value, max, color = BLUE }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs text-ink/55 w-36 flex-shrink-0 truncate" title={label}>{label}</div>
      <div className="flex-1 h-[7px] bg-tai-blue-light rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="font-mono text-xs text-tai-blue w-8 text-right">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════

export default function TeacherDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("files");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Files state
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Guardrails state
  const [guardrails, setGuardrails] = useState<Guardrails | null>(null);
  const [isSavingGuardrails, setIsSavingGuardrails] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [courseData, filesData, guardrailsData] = await Promise.all([
        getCourse(courseId),
        getCourseFiles(courseId),
        getGuardrails(courseId),
      ]);

      setCourse(courseData);
      setFiles(filesData);
      setGuardrails(guardrailsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error loading course",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [courseId, toast]);

  // Load analytics lazily when tab is selected
  const loadAnalytics = useCallback(async () => {
    if (analytics) return; // already loaded
    setAnalyticsLoading(true);
    try {
      const data = await getCourseAnalytics(courseId);
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      toast({
        title: "Error loading analytics",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [courseId, analytics, toast]);

  useEffect(() => {
    const role = getStoredRole();
    const userId = getStoredUserId();

    if (!role || !userId) { router.push("/"); return; }
    if (role !== "teacher") { router.push("/student"); return; }

    loadData();
  }, [loadData, router]);

  // Trigger analytics load when tab switches
  useEffect(() => {
    if (activeTab === "analytics") loadAnalytics();
  }, [activeTab, loadAnalytics]);

  // ── File handlers ──────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadFile(courseId, file);
      toast({ title: "File uploaded!", description: `Created ${result.chunks_created} searchable chunks` });
      const filesData = await getCourseFiles(courseId);
      setFiles(filesData);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This will remove all its chunks.`)) return;
    setDeletingFileId(fileId);
    try {
      await deleteCourseFile(courseId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast({ title: "File deleted", description: filename });
    } catch {
      toast({ title: "Delete failed", description: "Try again", variant: "destructive" });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleGuardrailChange = async (key: keyof Guardrails, value: unknown) => {
    if (!guardrails) return;
    const updated = { ...guardrails, [key]: value };
    setGuardrails(updated);
    setIsSavingGuardrails(true);
    try {
      await updateGuardrails(courseId, { [key]: value });
    } catch {
      toast({ title: "Failed to save", description: "Try again", variant: "destructive" });
    } finally {
      setIsSavingGuardrails(false);
    }
  };

  const copyClassCode = () => {
    if (course) {
      navigator.clipboard.writeText(course.class_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Loading screen ────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
      </div>
    );
  }

  // ── Render helpers for analytics sections ─────────
  const a = analytics; // shorthand

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/teacher"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-tai-blue flex items-center justify-center">
                <span className="font-mono text-xs font-bold text-white">TA</span>
              </div>
              <div>
                <h1 className="font-medium text-sm leading-none text-tai-blue">{course?.name}</h1>
                <button type="button" onClick={copyClassCode} aria-label="Copy class code"
                  className="text-xs text-ink/35 font-mono hover:text-tai-blue flex items-center gap-1 mt-0.5 transition-colors">
                  {course?.class_code}
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex border-b-2 border-black/10 mb-8 overflow-x-auto">
          {([
            { id: "files" as Tab, label: "Files", icon: FileText },
            { id: "guardrails" as Tab, label: "Guardrails", icon: Settings },
            { id: "analytics" as Tab, label: "Analytics", icon: BarChart3 },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 text-sm font-medium tracking-wide whitespace-nowrap flex-shrink-0 transition-opacity",
                activeTab === id ? "text-tai-blue opacity-100" : "text-ink opacity-40 hover:opacity-70",
              )}>
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === id && <span className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-tai-accent" />}
            </button>
          ))}
        </div>

        {/* ═══ Files Tab ═══ */}
        {activeTab === "files" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Upload Materials</CardTitle>
                <CardDescription>Upload PDFs or text files for students to learn from</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block">
                  <div className="border-2 border-dashed border-tai-blue/15 rounded-xl p-8 text-center cursor-pointer hover:border-tai-blue/30 hover:bg-tai-blue-light/50 transition-colors">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
                        <p className="text-sm text-ink/45">Uploading & processing...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-tai-blue/30 mb-2" />
                        <p className="text-sm font-medium text-tai-blue">Click to upload</p>
                        <p className="text-xs text-ink/35">PDF, TXT, or MD files</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept=".pdf,.txt,.md" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Uploaded Files</CardTitle>
                <CardDescription>{files.length} file(s) uploaded</CardDescription>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <p className="text-sm text-ink/35 text-center py-4">No files uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-tai-blue-light/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-tai-blue/40" />
                          <div>
                            <p className="text-sm font-medium text-ink">{file.filename}</p>
                            <p className="text-xs text-ink/35 font-mono">{new Date(file.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon"
                          onClick={() => handleDeleteFile(file.id, file.filename)} disabled={deletingFileId === file.id}>
                          {deletingFileId === file.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4 text-red-500" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ Guardrails Tab ═══ */}
        {activeTab === "guardrails" && guardrails && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Guardrails Settings</CardTitle>
                    <CardDescription>Control how TA-I responds to students</CardDescription>
                  </div>
                  {isSavingGuardrails && (
                    <span className="text-xs text-ink/35 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Allow Final Answer */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-tai-blue">Allow Final Answers</p>
                    <p className="text-xs text-ink/40">Let TA-I give complete solutions</p>
                  </div>
                  <button type="button" role="switch" aria-checked={guardrails.allow_final_answer} aria-label="Allow final answers"
                    onClick={() => handleGuardrailChange("allow_final_answer", !guardrails.allow_final_answer)}
                    className={cn("w-12 h-6 rounded-full transition-colors relative", guardrails.allow_final_answer ? "bg-tai-blue" : "bg-ink/15")}>
                    <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm", guardrails.allow_final_answer ? "translate-x-6" : "translate-x-0.5")} />
                  </button>
                </div>

                {/* Allow Code */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-tai-blue">Allow Code</p>
                    <p className="text-xs text-ink/40">Let TA-I include code in responses</p>
                  </div>
                  <button type="button" role="switch" aria-checked={guardrails.allow_code} aria-label="Allow code in responses"
                    onClick={() => handleGuardrailChange("allow_code", !guardrails.allow_code)}
                    className={cn("w-12 h-6 rounded-full transition-colors relative", guardrails.allow_code ? "bg-tai-blue" : "bg-ink/15")}>
                    <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm", guardrails.allow_code ? "translate-x-6" : "translate-x-0.5")} />
                  </button>
                </div>

                {/* Allow Worked Examples */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-tai-blue">Allow Worked Examples</p>
                    <p className="text-xs text-ink/40">Let TA-I provide worked examples with different numbers</p>
                  </div>
                  <button type="button" role="switch" aria-checked={guardrails.allow_worked_examples} aria-label="Allow worked examples"
                    onClick={() => handleGuardrailChange("allow_worked_examples", !guardrails.allow_worked_examples)}
                    className={cn("w-12 h-6 rounded-full transition-colors relative", guardrails.allow_worked_examples ? "bg-tai-blue" : "bg-ink/15")}>
                    <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm", guardrails.allow_worked_examples ? "translate-x-6" : "translate-x-0.5")} />
                  </button>
                </div>

                {/* Max Hint Level */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm text-tai-blue">Max Hint Level</p>
                      <p className="text-xs text-ink/40">How detailed can hints get?</p>
                    </div>
                    <span className="font-mono text-sm text-tai-blue font-bold">{guardrails.max_hint_level}</span>
                  </div>
                  <input type="range" min="0" max="3" value={guardrails.max_hint_level}
                    onChange={(e) => handleGuardrailChange("max_hint_level", parseInt(e.target.value))}
                    className="w-full accent-tai-blue" />
                  <div className="flex justify-between text-xs text-ink/35 mt-1">
                    <span>Concept only</span><span>Gentle hint</span><span>Structured</span><span>Example</span>
                  </div>
                </div>

                {/* Assessment Mode */}
                <div>
                  <p className="font-medium text-sm text-tai-blue mb-2">Assessment Mode</p>
                  <p className="text-xs text-ink/40 mb-3">Current student context</p>
                  <div className="grid grid-cols-5 gap-2">
                    {["homework", "quiz", "exam", "practice", "unknown"].map((mode) => (
                      <button key={mode} type="button" aria-pressed={guardrails.assessment_mode === mode}
                        onClick={() => handleGuardrailChange("assessment_mode", mode)}
                        className={cn("px-3 py-2 text-xs rounded-lg capitalize transition-colors font-medium",
                          guardrails.assessment_mode === mode ? "bg-tai-blue text-white" : "bg-tai-blue-light text-tai-blue hover:bg-tai-blue/10")}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Course Level */}
                <div>
                  <p className="font-medium text-sm text-tai-blue mb-2">Course Level</p>
                  <p className="text-xs text-ink/40 mb-3">Adjust language complexity</p>
                  <div className="grid grid-cols-4 gap-2">
                    {["elementary", "middle", "high", "university"].map((level) => (
                      <button key={level} type="button" aria-pressed={guardrails.course_level === level}
                        onClick={() => handleGuardrailChange("course_level", level)}
                        className={cn("px-3 py-2 text-xs rounded-lg capitalize transition-colors font-medium",
                          guardrails.course_level === level ? "bg-tai-blue text-white" : "bg-tai-blue-light text-tai-blue hover:bg-tai-blue/10")}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instructor Note */}
                <div>
                  <p className="font-medium text-sm text-tai-blue mb-1">Instructor Note</p>
                  <p className="text-xs text-ink/40 mb-3">Optional message shown to students when a guardrail redirect occurs</p>
                  <textarea
                    value={guardrails.instructor_note ?? ""}
                    onChange={(e) => handleGuardrailChange("instructor_note", e.target.value || null)}
                    placeholder="e.g. Try working through the practice problems in Chapter 3 first."
                    rows={2}
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-tai-blue/30 resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ Analytics Tab ═══ */}
        {activeTab === "analytics" && (
          <>
            {analyticsLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
              </div>
            )}

            {!analyticsLoading && a && (
              <div className="space-y-10">

                {/* ── Section 1: Overview KPIs ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Sessions", value: a.overview.total_sessions },
                    { label: "Messages", value: a.overview.total_messages },
                    { label: "Students", value: a.overview.unique_students },
                    { label: "Avg Queries / Student", value: a.overview.avg_queries_per_student },
                    { label: "Avg Session Depth", value: a.overview.avg_session_depth },
                  ].map(({ label, value }) => (
                    <Card key={label}>
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="font-serif text-3xl text-tai-blue">{value}</p>
                        <p className="text-[10px] text-ink/40 font-mono tracking-wide mt-1 uppercase">{label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* ── Section 2: Topic & Concept Analysis ── */}
                <Section icon={BookOpen} title="Topic & Concept Analysis" description="What are students asking about and struggling with?">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Most Asked Topics */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Most Asked Topics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {a.topic_analysis.top_topics.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No topic data yet</p>
                        ) : (
                          <div className="space-y-2">
                            {a.topic_analysis.top_topics.slice(0, 10).map((t) => (
                              <HorizontalBar key={t.topic} label={t.topic} value={t.count}
                                max={a.topic_analysis.top_topics[0]?.count || 1} color={BLUE} />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Concept Difficulty Heat Map */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Concept Difficulty</CardTitle>
                        <CardDescription className="text-xs">Higher hint levels = harder concepts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.topic_analysis.top_topics.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No data yet</p>
                        ) : (
                          <div className="space-y-2">
                            {a.topic_analysis.top_topics
                              .slice()
                              .sort((x, y) => y.avg_hint_level - x.avg_hint_level)
                              .slice(0, 8)
                              .map((t) => {
                                const intensity = Math.min(t.avg_hint_level / 3, 1);
                                const barColor = intensity > 0.5 ? ACCENT : BLUE_MID;
                                return (
                                  <div key={t.topic} className="flex items-center gap-3">
                                    <div className="text-xs text-ink/55 w-36 flex-shrink-0 truncate" title={t.topic}>{t.topic}</div>
                                    <div className="flex-1 h-[7px] bg-tai-blue-light rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all"
                                        style={{ width: `${Math.max(intensity * 100, 8)}%`, backgroundColor: barColor }} />
                                    </div>
                                    <div className="font-mono text-xs w-10 text-right" style={{ color: barColor }}>
                                      {t.avg_hint_level.toFixed(1)}
                                    </div>
                                  </div>
                                );
                              })}
                            <div className="flex items-center justify-between text-[10px] text-ink/30 mt-2 px-1">
                              <span>Easy</span>
                              <span>Hard</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* First-Touch Topics */}
                  {a.topic_analysis.first_touch_topics.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">First-Touch Topics</CardTitle>
                        <CardDescription className="text-xs">What students ask about first when they open TA-I</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {a.topic_analysis.first_touch_topics.map((ft) => (
                            <span key={ft.topic}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tai-blue-light rounded-full text-xs text-tai-blue font-medium">
                              {ft.topic}
                              <span className="bg-tai-blue/10 text-tai-blue rounded-full px-1.5 py-0.5 text-[10px] font-mono">{ft.count}</span>
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Section>

                {/* ── Section 3: Source Analysis ── */}
                <Section icon={FileText} title="Source Analysis" description="Which materials are referenced most and where are the gaps?">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Most Referenced Sources</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {a.source_analysis.top_sources.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No source data yet</p>
                        ) : (
                          <div className="space-y-2">
                            {a.source_analysis.top_sources.map((s) => (
                              <HorizontalBar key={s.filename} label={s.filename} value={s.reference_count}
                                max={a.source_analysis.top_sources[0]?.reference_count || 1} color={BLUE_MID} />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-tai-accent" />
                          Source Citation Gaps
                        </CardTitle>
                        <CardDescription className="text-xs">Files with content gaps or no references</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.source_analysis.citation_gaps.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No gaps detected</p>
                        ) : (
                          <div className="space-y-2">
                            {a.source_analysis.citation_gaps.map((g) => (
                              <div key={g.filename} className="flex items-center justify-between p-2.5 bg-tai-accent/5 border border-tai-accent/10 rounded-lg">
                                <span className="text-xs text-ink/60 truncate flex-1" title={g.filename}>{g.filename}</span>
                                {g.unanswered_count > 0 && (
                                  <span className="text-[10px] font-mono text-tai-accent ml-2">{g.unanswered_count} gaps</span>
                                )}
                                {g.unanswered_count === 0 && (
                                  <span className="text-[10px] font-mono text-ink/30 ml-2">unreferenced</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </Section>

                {/* ── Section 4: Struggle & Confusion Signals ── */}
                <Section icon={Flame} title="Struggle & Confusion Signals" description="Where students are getting stuck">
                  {/* Difficult Topics */}
                  {a.struggle_signals.difficult_topics.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Difficult Concepts</CardTitle>
                        <CardDescription className="text-xs">Topics that require the most hints or follow-up questions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {a.struggle_signals.difficult_topics.map((dt) => (
                            <div key={dt.topic} className="flex items-center gap-3 p-2.5 bg-tai-accent/5 rounded-lg">
                              <Flame className="w-3.5 h-3.5 text-tai-accent flex-shrink-0" />
                              <span className="text-xs text-ink/70 flex-1">{dt.topic}</span>
                              <span className="text-[10px] font-mono text-ink/40">{dt.follow_up_count} follow-ups</span>
                              <span className="text-[10px] font-mono text-tai-accent">avg hint {dt.avg_hints.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Dead-End Sessions */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-tai-accent" />
                          Dead-End Sessions
                        </CardTitle>
                        <CardDescription className="text-xs">Students who seemed stuck despite multiple attempts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.struggle_signals.dead_end_sessions.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No dead-end sessions detected</p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {a.struggle_signals.dead_end_sessions.map((de) => (
                              <div key={de.session_id} className="p-2.5 bg-tai-blue-light/50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-mono text-ink/30">{de.student_id.slice(0, 16)}...</span>
                                  <span className="text-[10px] text-ink/30">{de.message_count} msgs</span>
                                </div>
                                <p className="text-xs text-ink/55 truncate">&quot;{de.last_question}&quot;</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Unanswered Questions */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-tai-accent" />
                          Unanswered Questions
                        </CardTitle>
                        <CardDescription className="text-xs">Questions TA-I couldn&apos;t answer from uploaded materials</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.struggle_signals.unanswered_questions.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">All questions answered</p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {a.struggle_signals.unanswered_questions.map((uq, i) => (
                              <div key={i} className="p-2.5 bg-tai-accent/5 border border-tai-accent/10 rounded-lg">
                                <p className="text-xs text-ink/60">&quot;{uq.question}&quot;</p>
                                <p className="text-[10px] text-ink/30 mt-1">
                                  {new Date(uq.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </Section>

                {/* ── Section 5: Engagement Patterns ── */}
                <Section icon={Clock} title="Engagement & Behavior Patterns" description="When and how are students using TA-I?">
                  {/* Calendar Heatmap – replaces Activity by Hour & Day of Week */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Activity Calendar</CardTitle>
                      <CardDescription className="text-xs">Daily usage across the calendar — spot cramming vs consistent study</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {a.engagement.activity_over_time.length === 0 ? (
                        <p className="text-xs text-ink/35 text-center py-4">No activity data yet</p>
                      ) : (
                        <CalendarHeatmap data={a.engagement.activity_over_time} />
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Session Depth Distribution */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Session Depth</CardTitle>
                        <CardDescription className="text-xs">Shallow = lookup, Deep = genuine wrestling with concepts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.engagement.session_depth_buckets.every((b) => b.count === 0) ? (
                          <p className="text-xs text-ink/35 text-center py-4">No session data yet</p>
                        ) : (
                          <div className="flex items-end gap-2 h-28 pt-4">
                            {a.engagement.session_depth_buckets.map((b) => {
                              const maxCount = Math.max(...a.engagement.session_depth_buckets.map((x) => x.count), 1);
                              const pct = (b.count / maxCount) * 100;
                              return (
                                <div key={b.bucket} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-[10px] font-mono text-tai-blue">{b.count}</span>
                                  <div className="w-full rounded-t-md bg-tai-blue transition-all"
                                    style={{ height: `${Math.max(pct, 4)}%` }} />
                                  <span className="text-[10px] text-ink/35">{b.bucket}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Activity Over Time */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Activity Over Time</CardTitle>
                        <CardDescription className="text-xs">Daily message volume (last 30 days)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {a.engagement.activity_over_time.length === 0 ? (
                          <p className="text-xs text-ink/35 text-center py-4">No activity data yet</p>
                        ) : (
                          <div className="h-32">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={a.engagement.activity_over_time} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                <defs>
                                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: INK_30 }} tickLine={false} axisLine={false}
                                  tickFormatter={(d: string) => { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}`; }} />
                                <YAxis tick={{ fontSize: 10, fill: INK_30 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2} fill="url(#areaGrad)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </Section>

                {/* ── Section 6: Student Cohorts ── */}
                <Section icon={Users} title="Student Cohorts" description="Usage segmentation across your class">
                  <Card>
                    <CardContent className="pt-6 pb-5">
                      {a.cohorts.total_enrolled === 0 && a.overview.unique_students === 0 ? (
                        <p className="text-xs text-ink/35 text-center py-4">No student data yet</p>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                          {/* Donut chart */}
                          <div className="flex justify-center">
                            <div className="relative w-48 h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: "Never Used", value: Math.max(a.cohorts.never_used, 0) },
                                      { name: "Light", value: a.cohorts.light_users },
                                      { name: "Moderate", value: a.cohorts.moderate_users },
                                      { name: "Heavy", value: a.cohorts.heavy_users },
                                    ].filter((d) => d.value > 0)}
                                    innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
                                  >
                                    {[INK_30, BLUE_LIGHT, BLUE_MID, BLUE].map((color, i) => (
                                      <Cell key={i} fill={color} stroke="none" />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="font-serif text-2xl text-tai-blue">
                                  {a.cohorts.total_enrolled || a.overview.unique_students}
                                </span>
                                <span className="text-[10px] text-ink/35 font-mono">ENROLLED</span>
                              </div>
                            </div>
                          </div>

                          {/* Legend / stats */}
                          <div className="space-y-3">
                            {[
                              { label: "Never Used", value: a.cohorts.never_used, color: INK_30, desc: "0 sessions" },
                              { label: "Light Users", value: a.cohorts.light_users, color: BLUE_LIGHT, desc: "< 5 sessions" },
                              { label: "Moderate Users", value: a.cohorts.moderate_users, color: BLUE_MID, desc: "5-9 sessions" },
                              { label: "Heavy Users", value: a.cohorts.heavy_users, color: BLUE, desc: "10+ sessions" },
                            ].map((row) => (
                              <div key={row.label} className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} />
                                <div className="flex-1">
                                  <span className="text-sm text-ink/70">{row.label}</span>
                                  <span className="text-[10px] text-ink/30 ml-1.5">({row.desc})</span>
                                </div>
                                <span className="font-mono text-sm text-tai-blue font-medium">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Section>

              </div>
            )}

            {!analyticsLoading && !a && (
              <div className="text-center py-20">
                <MessageSquare className="w-10 h-10 mx-auto text-ink/15 mb-3" />
                <p className="text-sm text-ink/40">No analytics data available yet.</p>
                <p className="text-xs text-ink/25 mt-1">Analytics will appear once students start using TA-I.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
