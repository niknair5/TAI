"use client";

import { useRef, useEffect, useState } from "react";
import { ChatMessage } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { HintControls } from "./HintControls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, MessageSquare } from "lucide-react";

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, requestHintIncrease?: boolean) => void;
  isSending: boolean;
  currentHintLevel: number;
  error: string | null;
}

export function ChatWindow({
  messages,
  onSendMessage,
  isSending,
  currentHintLevel,
  error,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending) return;
    
    onSendMessage(inputValue.trim());
    setInputValue("");
  };

  const handleHintRequest = (type: "concept" | "hint" | "more") => {
    const prefixes = {
      concept: "Can you explain the concept behind this? ",
      hint: "Can you give me a hint? ",
      more: "Can you give me another hint? ",
    };
    
    if (inputValue.trim()) {
      // If there's existing input, prepend the hint request
      onSendMessage(prefixes[type] + inputValue.trim(), type === "more");
      setInputValue("");
    } else if (messages.length > 0) {
      // If no input but there's message history, request another hint
      onSendMessage(prefixes[type] + "I'm still working on the previous question.", type === "more");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-6 space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-medium mb-2">Start a conversation</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Ask me about your course materials. I can explain concepts, 
                give hints on problems, and help you understand the material better.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          
          {/* Typing indicator */}
          {isSending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">TA</span>
              </div>
              <div className="bg-card rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/70 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-muted-foreground/70 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-muted-foreground/70 rounded-full typing-dot" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Hint Controls */}
          <HintControls
            onRequestHint={handleHintRequest}
            currentHintLevel={currentHintLevel}
            disabled={isSending}
            hasMessages={messages.length > 0}
          />
          
          {/* Message Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your course..."
              className="flex-1 h-11 bg-background"
              disabled={isSending}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-11 w-11 shrink-0"
              disabled={!inputValue.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
