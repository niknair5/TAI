"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MessageSquare, Loader2, LogOut, ArrowRight } from "lucide-react";
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
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tai-accent inline-block" />
              <span className="font-mono font-bold text-sm tracking-widest text-tai-blue">TA-I</span>
            </div>
            <span className="text-xs text-ink/35 font-mono border-l border-black/10 pl-3">Student</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleSwitchRole} className="text-ink/50 hover:text-ink">
            <LogOut className="w-4 h-4 mr-2" />
            Switch Role
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl text-tai-blue">My Classes</h2>
            <p className="text-ink/45 text-sm mt-1">Select a class to start chatting</p>
          </div>
          <Button type="button" variant="accent" onClick={() => setShowJoinForm(!showJoinForm)}>
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
          <Card className="border-dashed border-2 border-tai-blue/10">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-tai-blue-light flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-tai-blue/40" />
              </div>
              <h3 className="font-serif text-xl text-tai-blue mb-2">No classes yet</h3>
              <p className="text-ink/40 text-sm mb-6">
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
              <Link key={course.id} href={`/student/chat/${course.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tai-blue/30 focus-visible:ring-offset-2 ring-offset-paper rounded-xl">
                <Card className="h-full hover:shadow-md hover:border-tai-blue/20 transition-all cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg group-hover:text-tai-accent transition-colors">
                          {course.name}
                        </CardTitle>
                        <CardDescription className="font-mono">
                          {course.class_code}
                        </CardDescription>
                      </div>
                      <ArrowRight className="w-5 h-5 text-ink/20 group-hover:text-tai-accent transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-ink/40">
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
