"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  BookOpen,
  Users,
  ArrowRight,
  Plus,
  X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { API_URL, getMyCourses, joinCourse, validateJoinCode, type Course } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Tab section data                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  {
    id: "knowledge",
    label: "Instructor Knowledge Base",
    tag: "Feature 01",
    title: "TA-I only knows what you\u2019ve taught",
    desc: "Upload your lectures, rubrics, readings, and assignments. TA-I operates exclusively within that boundary \u2014 it cannot introduce outside concepts, skip ahead in the term, or reference material you haven\u2019t covered.",
    points: [
      "Upload PDFs, slides, notes, and rubrics in minutes",
      "Hard limits on what TA-I can discuss \u2014 by topic, week, or assignment",
      "Responses use your terminology, notation, and style",
    ],
  },
  {
    id: "hinting",
    label: "Progressive Hinting",
    tag: "Feature 02",
    title: "Guidance that builds understanding, step by step",
    desc: "TA-I doesn\u2019t hand over answers. It scaffolds each student through a problem the way a skilled human TA would \u2014 asking the right question at the right moment, then stepping back.",
    points: [
      "Multi-level hint sequences configured per assignment",
      "Students can never skip ahead of what the instructor allows",
      "Encourages productive struggle, not passive consumption",
    ],
  },
  {
    id: "analytics",
    label: "Learning Insights",
    tag: "Feature 03",
    title: "Know where your class is struggling \u2014 before class",
    desc: "TA-I surfaces what\u2019s actually confusing students in real time. See which topics required the most hints, where students gave up, and who might need a check-in.",
    points: [
      "Per-topic confusion heatmaps updated in real time",
      "Flags students cycling through hints without progress",
      "Exportable reports for office hours and course planning",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Main landing page                                                  */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const [pageReady, setPageReady] = useState(false);
  const [studentCourses, setStudentCourses] = useState<Course[] | null>(null);
  const [activeTab, setActiveTab] = useState("knowledge");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setPageReady(true);
        return;
      }
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) setPageReady(true);
        return;
      }
      const me = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!me.ok) {
        if (!cancelled) setPageReady(true);
        return;
      }
      const row = (await me.json()) as { role: string };
      if (row.role === "instructor") {
        router.replace("/dashboard");
        return;
      }
      try {
        const courses = await getMyCourses();
        if (cancelled) return;
        setStudentCourses(courses);
      } catch {
        if (!cancelled) setStudentCourses([]);
      }
      if (!cancelled) setPageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setStudentCourses(null);
    setPageReady(true);
    router.refresh();
  }, [router]);

  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinPreview, setJoinPreview] = useState<string | null>(null);

  const handleJoinCodeChange = useCallback(async (raw: string) => {
    const code = raw.toUpperCase();
    setJoinCode(code);
    setJoinError(null);
    setJoinPreview(null);
    if (code.replace(/\s/g, "").length === 8) {
      try {
        const result = await validateJoinCode(code);
        if (result) setJoinPreview(result.name);
        else setJoinError("Invalid join code.");
      } catch {
        /* ignore transient errors during typing */
      }
    }
  }, []);

  const handleJoinSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const normalized = joinCode.trim().replace(/\s/g, "");
    if (normalized.length !== 8) {
      setJoinError("Enter an 8-character join code.");
      return;
    }
    setJoinLoading(true);
    try {
      const course = await joinCourse(normalized);
      setStudentCourses((prev) => (prev ? [...prev, course] : [course]));
      setJoinCode("");
      setJoinPreview(null);
      setShowJoinForm(false);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join course.");
    } finally {
      setJoinLoading(false);
    }
  }, [joinCode]);

  if (!pageReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
      </div>
    );
  }

  /* ── Signed-in student: show course list ── */
  if (studentCourses !== null) {
    return (
      <div className="min-h-screen bg-paper">
        <nav className="flex items-center justify-between px-6 md:px-14 py-5 border-b border-black/10">
          <span className="font-mono font-bold text-lg tracking-widest text-tai-blue flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
            TA-I
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-serif text-3xl text-tai-blue">Your courses</h1>
            {!showJoinForm && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-tai-blue/30 text-tai-blue"
                onClick={() => { setShowJoinForm(true); setJoinError(null); setJoinPreview(null); setJoinCode(""); }}
              >
                <Plus className="w-4 h-4" />
                Join a class
              </Button>
            )}
          </div>
          <p className="text-sm text-ink/45 mb-8">Open a course to chat with TA-I</p>

          {showJoinForm && (
            <Card className="mb-6 border-tai-blue/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Join a new class</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-ink/40 hover:text-ink"
                    onClick={() => { setShowJoinForm(false); setJoinError(null); setJoinPreview(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>Enter the 8-character code your instructor shared</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinSubmit} className="space-y-3">
                  <Input
                    placeholder="e.g. X7K2M9NP"
                    value={joinCode}
                    onChange={(e) => handleJoinCodeChange(e.target.value)}
                    className="font-mono text-center text-lg tracking-widest"
                    maxLength={8}
                    autoComplete="off"
                    autoFocus
                    disabled={joinLoading}
                  />
                  {joinPreview && (
                    <p className="text-sm text-tai-blue font-medium">{joinPreview}</p>
                  )}
                  {joinError && (
                    <p className="text-sm text-red-600">{joinError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={joinLoading || joinCode.replace(/\s/g, "").length < 8}
                  >
                    {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join course"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {studentCourses.length === 0 && !showJoinForm ? (
            <Card>
              <CardContent className="py-10 text-center text-ink/45 text-sm">
                You&apos;re not enrolled in any course yet.{" "}
                <button
                  type="button"
                  className="text-tai-blue font-medium hover:underline"
                  onClick={() => { setShowJoinForm(true); setJoinError(null); setJoinPreview(null); setJoinCode(""); }}
                >
                  Join with a code
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {studentCourses.map((c) => (
                <Link key={c.id} href={`/course/${c.id}`}>
                  <Card className="hover:border-tai-blue/30 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">{c.name}</CardTitle>
                      <CardDescription className="font-mono">{c.join_code}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ── Marketing landing page ── */
  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <>
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 md:px-14 py-5 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <span className="font-mono font-bold text-lg tracking-widest text-tai-blue flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
          TA-I
        </span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <a href="#features" className="font-medium tracking-wide text-ink/50 hover:text-ink transition-colors no-underline">
            How It Works
          </a>

          <span className="h-4 w-px bg-black/10" aria-hidden />

          <span className="text-ink/35 text-xs uppercase tracking-wider">Students</span>
          <Link href="/auth/student-login" className="font-medium text-ink/50 hover:text-tai-blue">
            Sign in
          </Link>
          <Link href="/join" className="font-medium text-tai-blue hover:underline">
            Sign up
          </Link>

          <span className="h-4 w-px bg-black/10" aria-hidden />

          <span className="text-ink/35 text-xs uppercase tracking-wider">Instructors</span>
          <Link
            href="/auth/instructor-login"
            className="font-medium text-tai-blue border border-tai-blue/30 px-4 py-2 rounded hover:bg-tai-blue-light transition-colors"
          >
            Sign in
          </Link>
          <Link href="/auth/instructor-signup" className="font-medium text-tai-blue hover:underline">
            Sign up
          </Link>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-2 text-sm">
          <Link href="/auth/student-login" className="font-medium text-ink/50 hover:text-tai-blue px-2 py-2">
            Student
          </Link>
          <Link
            href="/auth/instructor-login"
            className="font-medium text-white bg-tai-blue px-4 py-2 rounded hover:bg-tai-blue-mid transition-colors"
          >
            Instructor
          </Link>
        </div>
      </nav>

      <main>
        {/* ── HERO ── */}
        <section className="relative min-h-[calc(100vh-68px)] overflow-hidden">
          <div className="hero-grid-bg absolute inset-0 pointer-events-none z-0" />
          <div
            className="hidden md:block absolute top-[-10%] right-[-4%] w-[52%] h-[130%] bg-tai-blue z-0"
            style={{ clipPath: "polygon(16% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-6 md:px-14">
            {/* Left column */}
            <div className="py-16 md:py-20 animate-rise animate-rise-delay-1">
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-tai-accent mb-5 flex items-center gap-3">
                <span className="block w-7 h-0.5 bg-tai-accent flex-shrink-0" />
                AI for Education — Done Right
              </p>

              <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl leading-none text-tai-blue mb-6 tracking-tight">
                The TA that<br />knows your<br /><em className="italic text-tai-accent">syllabus.</em>
              </h1>

              <p className="text-base leading-7 text-ink/60 max-w-md mb-10">
                TA-I is the first AI teaching assistant that works within your curriculum — not around it. Instructor-controlled, pedagogically sound, and built to help students learn, not just get answers.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-wrap">
                <Button
                  asChild
                  size="lg"
                  className="bg-tai-accent hover:bg-[#c94e10] text-white font-medium"
                >
                  <Link href="/join" className="inline-flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    I have a join code
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-tai-blue text-tai-blue">
                  <Link href="/auth/instructor-login" className="inline-flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    I&apos;m an instructor
                  </Link>
                </Button>
              </div>

              <div className="mt-8 space-y-3 text-sm text-ink/55 max-w-md border-t border-black/10 pt-8">
                <p>
                  <span className="font-semibold text-ink/80">Students</span>
                  {" — "}
                  Use the code from your instructor to{" "}
                  <Link href="/join" className="text-tai-blue font-medium hover:underline">
                    create your account
                  </Link>
                  {" "}(.edu email). Already set up?{" "}
                  <Link href="/auth/student-login" className="text-tai-blue font-medium hover:underline">
                    Sign in
                  </Link>
                  .
                </p>
                <p>
                  <span className="font-semibold text-ink/80">Instructors</span>
                  {" — "}
                  <Link href="/auth/instructor-signup" className="text-tai-blue font-medium hover:underline">
                    Create an account
                  </Link>
                  {" "}
                  to build courses, or{" "}
                  <Link href="/auth/instructor-login" className="text-tai-blue font-medium hover:underline">
                    sign in
                  </Link>
                  {" "}
                  to your dashboard.
                </p>
              </div>
            </div>

            {/* Right column — Demo chat card */}
            <div className="hidden md:flex items-center justify-center py-16 px-6 animate-rise animate-rise-delay-2">
              <div className="bg-white/[0.08] border border-white/[0.14] rounded-2xl p-8 w-full max-w-sm shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-tai-accent flex items-center justify-center font-mono text-xs font-bold text-white">
                    TA-I
                  </div>
                  <div>
                    <div className="font-mono text-sm text-white/90 tracking-wide">TA-I Assistant</div>
                    <div className="text-xs text-white/40 mt-0.5">CHEM 201 · Week 7</div>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-500 status-dot-pulse" />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="animate-pop-in rounded-xl rounded-bl-sm px-4 py-3 bg-white/10 text-white/80 text-sm leading-relaxed max-w-[88%] self-start" style={{ animationDelay: "0.9s" }}>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">Student</div>
                    I don&apos;t get step 3. Can you just show me the answer?
                  </div>
                  <div className="animate-pop-in rounded-xl rounded-br-sm px-4 py-3 bg-tai-accent text-white text-sm leading-relaxed max-w-[88%] self-end" style={{ animationDelay: "1.7s" }}>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">TA-I</div>
                    I can&apos;t give the final answer — but let&apos;s work through it. What do you recall about Le Chatelier&apos;s principle from Tuesday?
                    <div className="inline-block bg-white/15 font-mono text-[10px] px-2 py-0.5 rounded mt-2">📚 Course-aligned hint</div>
                  </div>
                  <div className="animate-pop-in rounded-xl rounded-bl-sm px-4 py-3 bg-white/10 text-white/80 text-sm leading-relaxed max-w-[88%] self-start" style={{ animationDelay: "2.6s" }}>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">Student</div>
                    Oh — is it about equilibrium shifting?
                  </div>
                  <div className="animate-pop-in rounded-xl rounded-br-sm px-4 py-3 bg-tai-accent text-white text-sm leading-relaxed max-w-[88%] self-end" style={{ animationDelay: "3.4s" }}>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">TA-I</div>
                    Exactly. Now apply that to the concentration at step 3. You&apos;re closer than you think.
                    <div className="inline-block bg-white/15 font-mono text-[10px] px-2 py-0.5 rounded mt-2">✓ Within instructor limits</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile-only chat card */}
            <div className="flex md:hidden items-center justify-center py-12 px-6 -mx-6 mt-4 bg-tai-blue rounded-b-2xl animate-rise animate-rise-delay-2">
              <div className="bg-white/[0.08] border border-white/[0.14] rounded-2xl p-8 w-full max-w-sm shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-tai-accent flex items-center justify-center font-mono text-xs font-bold text-white">
                    TA-I
                  </div>
                  <div>
                    <div className="font-mono text-sm text-white/90 tracking-wide">TA-I Assistant</div>
                    <div className="text-xs text-white/40 mt-0.5">Your course materials only</div>
                  </div>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">
                  Join your class with an 8-character code, then get guided help that stays inside what your instructor uploaded.
                </p>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 border-t border-black/10 bg-cream">
            {[
              { num: "130K+", label: "K–12 schools in\nthe United States" },
              { num: "4,000+", label: "Degree-granting\ninstitutions" },
              { num: "$400B", label: "Global EdTech\nmarket by 2028" },
              { num: "24 / 7", label: "Always-on TA support\non your terms" },
            ].map((stat, i) => (
              <div
                key={stat.num}
                className={`px-6 md:px-10 py-6 ${i < 3 ? "border-r border-black/10" : ""} animate-rise`}
                style={{ animationDelay: `${0.7 + i * 0.15}s` }}
              >
                <div className="font-serif text-2xl md:text-3xl text-tai-blue leading-none mb-1">{stat.num}</div>
                <div className="text-xs tracking-wide text-ink/45 leading-relaxed whitespace-pre-line">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── TABS FEATURE SECTION ── */}
        <section id="features" className="bg-paper border-t border-black/10 px-6 md:px-14 py-20 md:py-24">
          <div className="text-center mb-14">
            <p className="font-mono text-xs tracking-[0.2em] uppercase text-tai-accent mb-3">What makes TA-I different</p>
            <h2 className="font-serif text-3xl md:text-4xl text-tai-blue leading-tight max-w-xl mx-auto">
              Every feature built around how teachers actually teach
            </h2>
          </div>

          {/* Tab bar */}
          <div className="flex justify-center border-b-2 border-black/10 mb-14 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 md:px-8 py-3.5 text-sm font-medium tracking-wide whitespace-nowrap flex-shrink-0 transition-opacity ${
                  activeTab === tab.id ? "text-tai-blue opacity-100" : "text-ink opacity-40 hover:opacity-70"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-tai-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Tab panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-tai-accent-soft text-tai-accent font-mono text-[11px] tracking-widest uppercase px-3 py-1 rounded mb-5">
                {currentTab.tag}
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-tai-blue leading-tight mb-4">{currentTab.title}</h3>
              <p className="text-sm leading-7 text-ink/55 mb-6">{currentTab.desc}</p>
              <ul className="flex flex-col gap-3">
                {currentTab.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-ink/65 leading-relaxed">
                    <div className="w-5 h-5 rounded-full bg-tai-blue-light text-tai-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-tai-blue-light rounded-2xl p-8 border border-tai-blue/10 min-h-[340px] flex items-center justify-center">
              {activeTab === "knowledge" && <KnowledgeVisual />}
              {activeTab === "hinting" && <HintingVisual />}
              {activeTab === "analytics" && <AnalyticsVisual />}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="border-t border-black/10 bg-cream">
          <div className="max-w-3xl mx-auto px-6 py-20 text-center">
            <h2 className="font-serif text-3xl md:text-4xl text-tai-blue mb-4">
              Bring structured AI into your classroom.
            </h2>
            <p className="text-ink/50 mb-10 max-w-lg mx-auto leading-relaxed">
              Built by University of Washington Computer Science students. Designed with classroom constraints in mind. Pilot-ready for real educational environments.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-tai-accent hover:bg-[#c94e10] text-white font-medium"
              >
                <Link href="/join" className="inline-flex items-center gap-2.5">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-tai-blue/30 text-tai-blue">
                <a href="mailto:tai-team@uw.edu?subject=Early%20Access%20Request">
                  Request Early Access
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-black/10 bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
            <span className="font-mono font-bold text-tai-blue tracking-wider">TA-I</span>
          </div>
          <p>TA-I is an early product. We&apos;re building with educators.</p>
        </div>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual components for feature tabs                                 */
/* ------------------------------------------------------------------ */

function KnowledgeVisual() {
  const files = [
    { icon: "📄", name: "Week 7 — Equilibrium Lecture.pdf", meta: "Uploaded · 2.4 MB", status: "Active", active: true },
    { icon: "📋", name: "Problem Set 3 — Rubric.pdf", meta: "Uploaded · 340 KB", status: "Active", active: true },
    { icon: "🔒", name: "Week 8 — Reaction Kinetics.pdf", meta: "Scheduled · unlocks Mon", status: "Locked", active: false },
    { icon: "📝", name: "Midterm Study Guide.pdf", meta: "Uploaded · 1.1 MB", status: "Active", active: true },
  ];

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-3.5 bg-white rounded-lg px-4 py-3 border border-tai-blue/[0.07] shadow-sm">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center text-base ${f.active ? "bg-tai-blue-light" : "bg-amber-50"}`}>
            {f.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink truncate">{f.name}</div>
            <div className="text-[11px] text-ink/35 font-mono">{f.meta}</div>
          </div>
          <div className={`font-mono text-[10px] px-2 py-0.5 rounded tracking-wide flex-shrink-0 ${
            f.active ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            {f.status}
          </div>
        </div>
      ))}
    </div>
  );
}

function HintingVisual() {
  const steps = [
    { num: 1, text: "What concept from Week 6 relates to this type of reaction?", dim: false },
    { num: 2, text: "Think about what changes when temperature increases. What does Le Chatelier\u2019s principle predict?", dim: false },
    { num: 3, text: "Now write out the equilibrium expression and see which direction it shifts...", dim: true },
    { num: 4, text: "🔒 Final hint — unlocks after 2 more attempts", dim: true },
  ];

  return (
    <div className="flex flex-col w-full">
      {steps.map((step, i) => (
        <div key={step.num} className="flex gap-3.5 relative">
          {i < steps.length - 1 && (
            <div className="absolute left-[14px] top-[30px] bottom-[-8px] w-px bg-tai-blue/15" />
          )}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 mt-1 relative z-10 ${
            step.dim ? "bg-tai-blue/[0.18] text-tai-blue" : "bg-tai-blue text-white"
          }`}>
            {step.num}
          </div>
          <div className={`bg-white rounded-lg px-3.5 py-3 mb-2 flex-1 border border-tai-blue/[0.07] ${step.dim ? "opacity-40" : ""}`}>
            <p className="text-sm leading-relaxed text-ink/80">{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [
    { label: "Le Chatelier\u2019s", value: 82, orange: true },
    { label: "Equilibrium expr.", value: 61, orange: true },
    { label: "Reaction rates", value: 38, orange: false },
    { label: "Mole fractions", value: 24, orange: false },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-tai-blue/[0.08] shadow-sm w-full">
      <div className="font-mono text-[10px] tracking-widest uppercase text-ink/35 mb-4">Topic confusion · Week 7</div>
      <div className="flex flex-col gap-2.5 mb-4">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <div className="text-xs text-ink/55 w-28 flex-shrink-0">{bar.label}</div>
            <div className="flex-1 h-[7px] bg-tai-blue-light rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${bar.orange ? "bg-tai-accent" : "bg-tai-blue"}`}
                style={{ width: `${bar.value}%` }}
              />
            </div>
            <div className="font-mono text-xs text-tai-blue w-7 text-right">{bar.value}%</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 pt-3.5 border-t border-black/10">
        {[
          { num: "247", label: "Questions asked" },
          { num: "18", label: "Students flagged" },
          { num: "3.2", label: "Avg hints / student" },
        ].map((stat) => (
          <div key={stat.label} className="text-center flex-1">
            <div className="font-serif text-xl text-tai-blue leading-none">{stat.num}</div>
            <div className="text-[10px] text-ink/38 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
