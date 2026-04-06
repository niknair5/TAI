"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  BookOpen,
  Users,
  ArrowRight,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { API_URL, getMyCourses, type Course } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  const [pageReady, setPageReady] = useState(false);
  const [studentCourses, setStudentCourses] = useState<Course[] | null>(null);
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
        if (courses.length === 1) {
          router.replace(`/course/${courses[0].id}`);
          return;
        }
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

  if (!pageReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-8 h-8 animate-spin text-tai-blue" />
      </div>
    );
  }

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
          <h1 className="font-serif text-3xl text-tai-blue mb-2">Your courses</h1>
          <p className="text-sm text-ink/45 mb-8">Open a course to chat with TA-I</p>
          {studentCourses.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-ink/45 text-sm">
                You&apos;re not enrolled in any course yet.{" "}
                <Link href="/join" className="text-tai-blue font-medium hover:underline">
                  Join with a code
                </Link>
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

  return (
    <>
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 md:px-14 py-5 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <span className="font-mono font-bold text-lg tracking-widest text-tai-blue flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
          TA-I
        </span>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <Link
            href="/auth/student-login"
            className="text-sm font-medium text-ink/50 hover:text-tai-blue px-3 py-2"
          >
            Student sign in
          </Link>
          <Link
            href="/auth/instructor-login"
            className="text-sm font-medium text-tai-blue border border-tai-blue/30 px-4 py-2 rounded hover:bg-tai-blue-light transition-colors"
          >
            Instructor sign in
          </Link>
        </div>
      </nav>

      <main>
        <section className="relative min-h-[calc(100vh-68px)] overflow-hidden">
          <div className="hero-grid-bg absolute inset-0 pointer-events-none z-0" />
          <div
            className="hidden md:block absolute top-[-10%] right-[-4%] w-[52%] h-[130%] bg-tai-blue z-0"
            style={{ clipPath: "polygon(16% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 items-center gap-10 px-6 md:px-14">
            <div className="py-16 md:py-20 animate-rise animate-rise-delay-1">
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-tai-accent mb-5 flex items-center gap-3">
                <span className="block w-7 h-0.5 bg-tai-accent flex-shrink-0" />
                AI for Education — Done Right
              </p>

              <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl leading-none text-tai-blue mb-6 tracking-tight">
                The TA that<br />knows your<br /><em className="italic text-tai-accent">syllabus.</em>
              </h1>

              <p className="text-base leading-7 text-ink/60 max-w-md mb-8">
                Sign in with your .edu email. Students join with a short code from their instructor — no extra accounts to juggle.
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
              <p className="text-xs text-ink/35 mt-4">
                Instructors: new here?{" "}
                <Link href="/auth/instructor-signup" className="text-tai-blue hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

            <div className="hidden md:flex items-center justify-center py-16 px-6 animate-rise animate-rise-delay-2">
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
        </section>

        <footer className="border-t border-black/10 bg-paper">
          <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink/40">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
              <span className="font-mono font-bold text-tai-blue tracking-wider">TA-I</span>
            </div>
            <p>Built for real classrooms.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
