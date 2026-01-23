"use client";

import { ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { User, FileText, AlertCircle } from "lucide-react";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isRefusal = message.content.includes("I don't have enough information");
  
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser 
            ? "bg-secondary" 
            : isRefusal 
              ? "bg-amber-500/10" 
              : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-secondary-foreground" />
        ) : isRefusal ? (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        ) : (
          <span className="text-xs font-bold text-primary">TA</span>
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : isRefusal
              ? "bg-amber-500/10 border border-amber-500/20 rounded-tl-md"
              : "bg-card rounded-tl-md"
        )}
      >
        {/* Main content */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {formatMessageContent(message.content)}
        </div>

        {/* Hint level indicator */}
        {!isUser && message.hint_level !== null && message.hint_level !== undefined && (
          <div className="mt-2 pt-2 border-t border-current/10">
            <span className="text-xs text-muted-foreground">
              Hint Level: {message.hint_level}
            </span>
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Sources
            </p>
            <ul className="space-y-1">
              {message.sources.map((source, index) => (
                <li
                  key={index}
                  className="text-xs text-muted-foreground/80 font-mono"
                >
                  {source.filename} (chunk {source.chunk_index})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMessageContent(content: string): React.ReactNode {
  // Simple formatting: handle **bold** and `code`
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
