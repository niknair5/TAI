"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Users, Loader2 } from "lucide-react";
import { getStoredRole, getStoredUserId, setStoredRole, setStoredUserId, getStoredDeviceId } from "@/lib/utils";
import { createOrGetUser } from "@/lib/api";

export default function RoleSelectPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | null>(null);
  const router = useRouter();

  // Check if user already has a role selected
  useEffect(() => {
    const existingRole = getStoredRole();
    const existingUserId = getStoredUserId();
    
    if (existingRole && existingUserId) {
      // Redirect to appropriate home
      router.push(existingRole === "teacher" ? "/teacher" : "/student");
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleRoleSelect = async (role: "student" | "teacher") => {
    setSelectedRole(role);
    
    try {
      const deviceId = getStoredDeviceId();
      const user = await createOrGetUser(deviceId, role);
      
      setStoredUserId(user.id);
      setStoredRole(role);
      
      router.push(role === "teacher" ? "/teacher" : "/student");
    } catch (error) {
      console.error("Failed to create user:", error);
      setSelectedRole(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-bold tracking-tight">
              TA-<span className="text-primary">I</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              AI-Powered Teaching Assistant
            </p>
          </div>
        </div>

        {/* Role selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Student Card */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 ${
              selectedRole === "student" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => !selectedRole && handleRoleSelect("student")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">I'm a Student</CardTitle>
              <CardDescription>
                Get help understanding course materials
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Ask questions about your coursework</li>
                <li>Get guided hints, not answers</li>
                <li>Learn from your uploaded materials</li>
              </ul>
              <Button 
                className="w-full mt-4" 
                disabled={selectedRole !== null}
                variant={selectedRole === "student" ? "default" : "outline"}
              >
                {selectedRole === "student" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Continue as Student"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Teacher Card */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-accent/50 ${
              selectedRole === "teacher" ? "border-accent ring-2 ring-accent/20" : ""
            }`}
            onClick={() => !selectedRole && handleRoleSelect("teacher")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <CardTitle className="text-xl">I'm a Teacher</CardTitle>
              <CardDescription>
                Set up and manage your courses
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Upload course materials</li>
                <li>Configure guardrails & hint levels</li>
                <li>View student activity logs</li>
              </ul>
              <Button 
                className="w-full mt-4" 
                disabled={selectedRole !== null}
                variant={selectedRole === "teacher" ? "default" : "outline"}
              >
                {selectedRole === "teacher" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Continue as Teacher"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your choice is saved locally. You can switch roles anytime.
        </p>
      </div>
    </div>
  );
}
