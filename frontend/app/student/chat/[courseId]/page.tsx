"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatWindow } from "@/components/ChatWindow";
import { getCourse, createSession, getSessionMessages, sendMessage, Course, ChatMessage, ChatResponse } from "@/lib/api";
import { getStoredDeviceId, getStoredRole, getStoredUserId } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
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
        const courseData = await getCourse(courseId);
        setCourse(courseData);
        
        const deviceId = getStoredDeviceId();
        const session = await createSession(courseId, deviceId);
        setSessionId(session.id);
        
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
      
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id);
        return [...filtered, 
          { ...tempUserMessage, id: `user-${Date.now()}` },
          response.message
        ];
      });
      
      setCurrentHintLevel(response.hint_level);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      setError("Failed to send message. Please try again.");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  }, [sessionId, isSending]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-tai-blue-light flex items-center justify-center animate-pulse">
            <span className="font-mono text-sm font-bold text-tai-blue">TA</span>
          </div>
          <p className="text-ink/45 text-sm">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
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
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/student">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-tai-blue flex items-center justify-center">
                <span className="font-mono text-xs font-bold text-white">TA</span>
              </div>
              <div>
                <h1 className="font-medium text-sm leading-none text-tai-blue">{course?.name}</h1>
                <p className="text-xs text-ink/35 font-mono mt-0.5">{course?.class_code}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/40">
              Hint Level: <span className="font-mono text-tai-blue font-bold">{currentHintLevel}/3</span>
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
