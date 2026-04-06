"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Settings, Loader2, LogOut, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMyCourses, createCourse, Course } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const loadCourses = useCallback(async () => {
    try {
      const list = await getMyCourses();
      setCourses(list);
    } catch (error) {
      console.error("Failed to load courses:", error);
      toast({
        title: "Could not load courses",
        description: error instanceof Error ? error.message : "Try signing in again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    setIsCreating(true);
    try {
      const course = await createCourse(newCourseName.trim(), newDescription.trim() || undefined);
      setCourses((prev) => [...prev, course]);
      setNewCourseName("");
      setNewDescription("");
      setShowCreateForm(false);
      toast({
        title: "Course created!",
        description: `Share join code ${course.join_code} with your students`,
      });
    } catch (error) {
      toast({
        title: "Failed to create course",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
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
      <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
              <span className="font-mono font-bold text-sm tracking-widest text-tai-blue">TA-I</span>
            </div>
            <span className="text-xs text-ink/35 font-mono border-l border-black/10 pl-3">Instructor</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleSignOut} className="text-ink/50 hover:text-ink">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl text-tai-blue">My Courses</h2>
            <p className="text-ink/45 text-sm mt-1">Manage courses, materials, and analytics</p>
          </div>
          <Button
            type="button"
            variant="accent"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Create New Course</CardTitle>
              <CardDescription>A unique 8-character join code is generated automatically</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <Input
                  placeholder="Course name (e.g., Introduction to Physics)"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  disabled={isCreating}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={isCreating}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newCourseName.trim() || isCreating}>
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Course"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {courses.length === 0 ? (
          <Card className="border-dashed border-2 border-tai-blue/10">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-tai-blue-light flex items-center justify-center mb-4">
                <Settings className="w-7 h-7 text-tai-blue/40" />
              </div>
              <h3 className="font-serif text-xl text-tai-blue mb-2">No courses yet</h3>
              <p className="text-ink/40 text-sm mb-6">Create your first course to get a join code for students</p>
              <Button type="button" variant="accent" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/course/${course.id}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tai-blue/30 focus-visible:ring-offset-2 ring-offset-paper rounded-xl"
              >
                <Card className="h-full hover:shadow-md hover:border-tai-blue/20 transition-all cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg group-hover:text-tai-accent transition-colors">
                          {course.name}
                        </CardTitle>
                        <CardDescription className="font-mono">{course.join_code}</CardDescription>
                      </div>
                      <ArrowRight className="w-5 h-5 text-ink/20 group-hover:text-tai-accent transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-ink/40">Manage materials and guardrails</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
