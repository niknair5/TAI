"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Plus, MessageSquare, Loader2, LogOut, ArrowRight } from "lucide-react";
import { getStoredRole, getStoredUserId, clearStoredUser } from "@/lib/utils";
import { getUserCourses, joinCourse, Course } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function StudentHomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const role = getStoredRole();
    const userId = getStoredUserId();
    
    if (!role || !userId) {
      router.push("/");
      return;
    }
    
    if (role !== "student") {
      router.push("/teacher");
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

  const handleJoinCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim()) return;
    
    const userId = getStoredUserId();
    if (!userId) return;
    
    setIsJoining(true);
    try {
      const course = await joinCourse(userId, classCode.trim().toUpperCase());
      setCourses(prev => {
        if (prev.find(c => c.id === course.id)) return prev;
        return [...prev, course];
      });
      setClassCode("");
      setShowJoinForm(false);
      toast({
        title: "Joined course!",
        description: `You've joined ${course.name}`,
      });
    } catch (error) {
      toast({
        title: "Failed to join",
        description: error instanceof Error ? error.message : "Course not found",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
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
              <p className="text-xs text-muted-foreground">Student</p>
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
            <h2 className="text-2xl font-bold">My Classes</h2>
            <p className="text-muted-foreground">Select a class to start chatting</p>
          </div>
          <Button type="button" onClick={() => setShowJoinForm(!showJoinForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Join Class
          </Button>
        </div>

        {/* Join Form */}
        {showJoinForm && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Join a Class</CardTitle>
              <CardDescription>Enter the class code from your instructor</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinCourse} className="flex gap-2">
                <Input
                  placeholder="Enter class code (e.g., CS101)"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  maxLength={10}
                  disabled={isJoining}
                />
                <Button type="submit" disabled={!classCode.trim() || isJoining}>
                  {isJoining ? (
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
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No classes yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Join a class using the code from your instructor
              </p>
              <Button type="button" variant="outline" onClick={() => setShowJoinForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Join Your First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link key={course.id} href={`/student/chat/${course.id}`}>
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
                      Click to start chatting
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
