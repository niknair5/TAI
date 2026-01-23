"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatWindow } from "@/components/ChatWindow";
import { getCourse, createSession, getSessionMessages, sendMessage, Course, ChatMessage, ChatResponse } from "@/lib/api";
import { getStoredDeviceId, getStoredRole, getStoredUserId } from "@/lib/utils";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function StudentChatPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check auth and initialize session
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
    
    async function init() {
      try {
        // Get course info
        const courseData = await getCourse(courseId);
        setCourse(courseData);
        
        // Get device ID for session
        const deviceId = getStoredDeviceId();
        
        // Create a new session
        const session = await createSession(courseId, deviceId);
        setSessionId(session.id);
        
        // Load existing messages (should be empty for new session)
        const existingMessages = await getSessionMessages(session.id);
        setMessages(existingMessages);
      } catch (err) {
        setError("Failed to load course. Please check your connection.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    init();
  }, [courseId, router]);

  const handleSendMessage = useCallback(async (content: string, requestHintIncrease: boolean = false) => {
    if (!sessionId || isSending) return;
    
    setIsSending(true);
    setError(null);
    
    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content,
      hint_level: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);
    
    try {
      const response: ChatResponse = await sendMessage({
        session_id: sessionId,
        message: content,
        request_hint_increase: requestHintIncrease,
      });
      
      // Replace temp message and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id);
        return [...filtered, 
          { ...tempUserMessage, id: `user-${Date.now()}` },
          response.message
        ];
      });
      
      setCurrentHintLevel(response.hint_level);
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      setError("Failed to send message. Please try again.");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  }, [sessionId, isSending]);

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button asChild variant="outline">
            <Link href="/student">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Classes
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/student">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm leading-none">{course?.name}</h1>
                <p className="text-xs text-muted-foreground font-mono">{course?.class_code}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Hint Level: <span className="font-mono text-foreground">{currentHintLevel}/3</span>
            </span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col">
        <ChatWindow
          messages={messages}
          onSendMessage={handleSendMessage}
          isSending={isSending}
          currentHintLevel={currentHintLevel}
          error={error}
        />
      </main>
    </div>
  );
}
