"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileText, Settings, Activity, Upload, Trash2, Copy, Check } from "lucide-react";
import { getStoredRole, getStoredUserId } from "@/lib/utils";
import { getCourse, getCourseFiles, deleteCourseFile, uploadFile, getGuardrails, updateGuardrails, getCourseActivity, Course, CourseFile, Guardrails, CourseActivity } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "files" | "guardrails" | "activity";

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

  // Activity state
  const [activity, setActivity] = useState<CourseActivity | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [courseData, filesData, guardrailsData, activityData] = await Promise.all([
        getCourse(courseId),
        getCourseFiles(courseId),
        getGuardrails(courseId),
        getCourseActivity(courseId),
      ]);

      setCourse(courseData);
      setFiles(filesData);
      setGuardrails(guardrailsData);
      setActivity(activityData);
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

  useEffect(() => {
    const role = getStoredRole();
    const userId = getStoredUserId();

    if (!role || !userId) {
      router.push("/");
      return;
    }

    if (role !== "teacher") {
      router.push("/student");
      return;
    }

    loadData();
  }, [loadData, router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadFile(courseId, file);
      toast({
        title: "File uploaded!",
        description: `Created ${result.chunks_created} searchable chunks`,
      });
      const filesData = await getCourseFiles(courseId);
      setFiles(filesData);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
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
      toast({
        title: "File deleted",
        description: filename,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Try again",
        variant: "destructive",
      });
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
    } catch (error) {
      toast({
        title: "Failed to save",
        description: "Try again",
        variant: "destructive",
      });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/teacher">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-tai-blue flex items-center justify-center">
                <span className="font-mono text-xs font-bold text-white">TA</span>
              </div>
              <div>
                <h1 className="font-medium text-sm leading-none text-tai-blue">{course?.name}</h1>
                <button
                  type="button"
                  onClick={copyClassCode}
                  aria-label="Copy class code"
                  className="text-xs text-ink/35 font-mono hover:text-tai-blue flex items-center gap-1 mt-0.5 transition-colors"
                >
                  {course?.class_code}
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex border-b-2 border-black/10 mb-8 overflow-x-auto">
          {[
            { id: "files" as Tab, label: "Files", icon: FileText },
            { id: "guardrails" as Tab, label: "Guardrails", icon: Settings },
            { id: "activity" as Tab, label: "Activity", icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 text-sm font-medium tracking-wide whitespace-nowrap flex-shrink-0 transition-opacity",
                activeTab === id
                  ? "text-tai-blue opacity-100"
                  : "text-ink opacity-40 hover:opacity-70"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === id && (
                <span className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-tai-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Files Tab */}
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
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
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
                  <p className="text-sm text-ink/35 text-center py-4">
                    No files uploaded yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-tai-blue-light/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-tai-blue/40" />
                          <div>
                            <p className="text-sm font-medium text-ink">{file.filename}</p>
                            <p className="text-xs text-ink/35 font-mono">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFile(file.id, file.filename)}
                          disabled={deletingFileId === file.id}
                        >
                          {deletingFileId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Guardrails Tab */}
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={guardrails.allow_final_answer}
                    aria-label="Allow final answers"
                    onClick={() => handleGuardrailChange("allow_final_answer", !guardrails.allow_final_answer)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      guardrails.allow_final_answer ? "bg-tai-blue" : "bg-ink/15"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm",
                        guardrails.allow_final_answer ? "translate-x-6" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>

                {/* Allow Code */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-tai-blue">Allow Code</p>
                    <p className="text-xs text-ink/40">Let TA-I include code in responses</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={guardrails.allow_code}
                    aria-label="Allow code in responses"
                    onClick={() => handleGuardrailChange("allow_code", !guardrails.allow_code)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      guardrails.allow_code ? "bg-tai-blue" : "bg-ink/15"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm",
                        guardrails.allow_code ? "translate-x-6" : "translate-x-0.5"
                      )}
                    />
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
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={guardrails.max_hint_level}
                    onChange={(e) => handleGuardrailChange("max_hint_level", parseInt(e.target.value))}
                    className="w-full accent-tai-blue"
                  />
                  <div className="flex justify-between text-xs text-ink/35 mt-1">
                    <span>Concept only</span>
                    <span>Gentle hint</span>
                    <span>Structured</span>
                    <span>Example</span>
                  </div>
                </div>

                {/* Assessment Mode */}
                <div>
                  <p className="font-medium text-sm text-tai-blue mb-2">Assessment Mode</p>
                  <p className="text-xs text-ink/40 mb-3">Current student context</p>
                  <div className="grid grid-cols-5 gap-2">
                    {["homework", "quiz", "exam", "practice", "unknown"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={guardrails.assessment_mode === mode}
                        onClick={() => handleGuardrailChange("assessment_mode", mode)}
                        className={cn(
                          "px-3 py-2 text-xs rounded-lg capitalize transition-colors font-medium",
                          guardrails.assessment_mode === mode
                            ? "bg-tai-blue text-white"
                            : "bg-tai-blue-light text-tai-blue hover:bg-tai-blue/10"
                        )}
                      >
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
                      <button
                        key={level}
                        type="button"
                        aria-pressed={guardrails.course_level === level}
                        onClick={() => handleGuardrailChange("course_level", level)}
                        className={cn(
                          "px-3 py-2 text-xs rounded-lg capitalize transition-colors font-medium",
                          guardrails.course_level === level
                            ? "bg-tai-blue text-white"
                            : "bg-tai-blue-light text-tai-blue hover:bg-tai-blue/10"
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && activity && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Sessions", value: activity.total_sessions },
                { label: "Messages", value: activity.total_messages },
                { label: "Students", value: activity.unique_students },
                { label: "Avg Hints", value: activity.avg_hints_per_session.toFixed(1) },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="pt-5 pb-4 text-center">
                    <p className="font-serif text-3xl text-tai-blue">{value}</p>
                    <p className="text-xs text-ink/40 font-mono tracking-wide mt-1">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest student interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.recent_activity.length === 0 ? (
                  <p className="text-sm text-ink/35 text-center py-4">
                    No student activity yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activity.recent_activity.map((item) => (
                      <div key={item.session_id} className="p-3 bg-tai-blue-light/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-ink/35">
                            {item.student_id.slice(0, 20)}...
                          </span>
                          <span className="text-xs text-ink/35">
                            {new Date(item.last_message_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-ink/60">
                          <span>{item.message_count} messages</span>
                          <span>
                            Hints: {item.hint_levels_used.length > 0 ? item.hint_levels_used.join(", ") : "none"}
                          </span>
                        </div>
                        {item.recent_questions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-black/5">
                            <p className="text-xs text-ink/35 mb-1">Recent questions:</p>
                            {item.recent_questions.map((q, i) => (
                              <p key={i} className="text-xs text-ink/55 truncate">
                                &quot;{q}&quot;
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
