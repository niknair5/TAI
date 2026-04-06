"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatWindow } from "@/components/ChatWindow";
import { SourcesPanel } from "@/components/SourcesPanel";
import { getCourse, createSession, getSessionMessages, sendMessage, Course, ChatMessage, ChatResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, LogOut, Loader2, FileQuestion, Layers, Headphones, BarChart3, Presentation, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function StudentChatPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [toolsPanelCollapsed, setToolsPanelCollapsed] = useState(false);
  const { toast } = useToast();

  const featureButtons = [
    { label: "Create Quiz", icon: FileQuestion, description: "Generate quizzes from your sources" },
    { label: "Flashcards", icon: Layers, description: "Create study flashcards" },
    { label: "Audio", icon: Headphones, description: "Generate audio summaries" },
    { label: "Reports", icon: BarChart3, description: "View learning reports" },
    { label: "Slide Deck", icon: Presentation, description: "Create slide presentations" },
    { label: "Video", icon: Video, description: "Generate video content" },
  ];

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  const handleFeatureClick = (label: string) => {
    toast({
      title: "Coming Soon!",
      description: `${label} will be available in a future update.`,
    });
  };

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/join?next=/course/${courseId}`);
          return;
        }

        const courseData = await getCourse(courseId);
        setCourse(courseData);

        const session = await createSession(courseId, user.id);
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
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-paper flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur-md">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-tai-blue flex items-center justify-center">
                <span className="font-mono text-xs font-bold text-white">TA</span>
              </div>
              <div>
                <h1 className="font-medium text-sm leading-none text-tai-blue">{course?.name}</h1>
                <p className="text-xs text-ink/35 font-mono mt-0.5">{course?.join_code}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink/40">
              Hint Level: <span className="font-mono text-tai-blue font-bold">{currentHintLevel}/3</span>
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-ink/40 hover:text-red-600 gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content: Sources Panel + Chat */}
      <div className="flex-1 flex min-h-0">
        {/* Sources Panel */}
        <SourcesPanel
          courseId={courseId}
          selectedFileIds={selectedFileIds}
          onSelectionChange={setSelectedFileIds}
        />

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            currentHintLevel={currentHintLevel}
            error={error}
          />
        </main>

        {/* Tools Panel (right side) */}
        {toolsPanelCollapsed ? (
          <div className="shrink-0 border-l border-black/10 bg-white flex flex-col items-center py-3 w-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-ink/40 hover:text-tai-blue"
              onClick={() => setToolsPanelCollapsed(false)}
              title="Show tools"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="shrink-0 w-56 border-l border-black/10 bg-white flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/50">Tools</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-ink/40 hover:text-tai-blue"
                onClick={() => setToolsPanelCollapsed(true)}
                title="Collapse panel"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Feature buttons */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {featureButtons.map(({ label, icon: Icon, description }) => (
                <button
                  key={label}
                  onClick={() => handleFeatureClick(label)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-tai-blue-light/70 group"
                >
                  <div className="mt-0.5 w-7 h-7 rounded-md bg-tai-blue-light flex items-center justify-center shrink-0 group-hover:bg-tai-blue/10 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-tai-blue/60 group-hover:text-tai-blue transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink/70 group-hover:text-tai-blue transition-colors leading-snug">
                      {label}
                    </p>
                    <p className="text-[10px] text-ink/30 mt-0.5 leading-tight">
                      {description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Coming soon note */}
            <div className="px-4 py-2.5 border-t border-black/5 bg-paper/50">
              <p className="text-[10px] text-ink/30 text-center italic">
                All tools coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
