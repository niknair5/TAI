"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Plus, Settings, Loader2, LogOut, ArrowRight, Users } from "lucide-react";
import { getStoredRole, getStoredUserId, clearStoredUser } from "@/lib/utils";
import { getUserCourses, joinCourse, createCourse, Course } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function TeacherHomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newClassCode, setNewClassCode] = useState("");
  const [joinClassCode, setJoinClassCode] = useState("");
  const router = useRouter();
  const { toast } = useToast();

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
    
    loadCourses(userId);
  }, [router]);

  const loadCourses = async (userId: string) => {
    try {
      const userCourses = await getUserCourses(userId);
      setCourses(userCourses);
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newClassCode.trim()) return;
    
    const userId = getStoredUserId();
    if (!userId) return;
    
    setIsCreating(true);
    try {
      // Create the course
      const course = await createCourse(newCourseName.trim(), newClassCode.trim().toUpperCase());
      
      // Join it as teacher
      await joinCourse(userId, course.class_code);
      
      setCourses(prev => [...prev, course]);
      setNewCourseName("");
      setNewClassCode("");
      setShowCreateForm(false);
      toast({
        title: "Course created!",
        description: `${course.name} (${course.class_code}) is ready`,
      });
    } catch (error) {
      toast({
        title: "Failed to create course",
        description: error instanceof Error ? error.message : "Try a different class code",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinClassCode.trim()) return;
    
    const userId = getStoredUserId();
    if (!userId) return;
    
    setIsCreating(true);
    try {
      const course = await joinCourse(userId, joinClassCode.trim().toUpperCase());
      setCourses(prev => {
        if (prev.find(c => c.id === course.id)) return prev;
        return [...prev, course];
      });
      setJoinClassCode("");
      setShowJoinForm(false);
      toast({
        title: "Joined course!",
        description: `You now manage ${course.name}`,
      });
    } catch (error) {
      toast({
        title: "Failed to join",
        description: error instanceof Error ? error.message : "Course not found",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchRole = () => {
    clearStoredUser();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">TA-I</h1>
              <p className="text-xs text-muted-foreground">Teacher</p>
            </div>
          </div>
          {/* type="button" — not a form submit; ensures correct keyboard behavior */}
          <Button type="button" variant="ghost" size="sm" onClick={handleSwitchRole}>
            <LogOut className="w-4 h-4 mr-2" />
            Switch Role
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">My Courses</h2>
            <p className="text-muted-foreground">Manage your courses and view student activity</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowJoinForm(!showJoinForm); setShowCreateForm(false); }}>
              <Users className="w-4 h-4 mr-2" />
              Join Existing
            </Button>
            <Button type="button" onClick={() => { setShowCreateForm(!showCreateForm); setShowJoinForm(false); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Course
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Create New Course</CardTitle>
              <CardDescription>Set up a new course for your students</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="Course name (e.g., Introduction to Physics)"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    disabled={isCreating}
                  />
                  <Input
                    placeholder="Class code (e.g., PHYS101)"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                    maxLength={10}
                    disabled={isCreating}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newCourseName.trim() || !newClassCode.trim() || isCreating}>
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Course"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Join Form */}
        {showJoinForm && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Join Existing Course</CardTitle>
              <CardDescription>Enter a class code to manage an existing course</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinCourse} className="flex gap-2">
                <Input
                  placeholder="Enter class code"
                  value={joinClassCode}
                  onChange={(e) => setJoinClassCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  maxLength={10}
                  disabled={isCreating}
                />
                <Button type="submit" disabled={!joinClassCode.trim() || isCreating}>
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Join"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Course List */}
        {courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No courses yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first course to get started
              </p>
              <Button type="button" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link key={course.id} href={`/teacher/course/${course.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background rounded-lg">
                <Card className="h-full hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {course.name}
                        </CardTitle>
                        <CardDescription className="font-mono">
                          {course.class_code}
                        </CardDescription>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Click to manage course
                    </p>
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
