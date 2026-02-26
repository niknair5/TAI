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
            ? "bg-tai-blue-light" 
            : isRefusal 
              ? "bg-amber-50" 
              : "bg-tai-accent/10"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-tai-blue" />
        ) : isRefusal ? (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        ) : (
          <span className="text-xs font-bold text-tai-accent font-mono">TA</span>
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-tai-blue text-white rounded-tr-md"
            : isRefusal
              ? "bg-amber-50 border border-amber-200 rounded-tl-md"
              : "bg-white border border-tai-blue/[0.07] rounded-tl-md"
        )}
      >
        {/* Main content */}
        <div className={cn(
          "text-sm whitespace-pre-wrap leading-relaxed",
          isUser ? "text-white" : "text-ink/80"
        )}>
          {formatMessageContent(message.content)}
        </div>

        {/* Hint level indicator */}
        {!isUser && message.hint_level !== null && message.hint_level !== undefined && (
          <div className={cn(
            "mt-2 pt-2 border-t",
            isRefusal ? "border-amber-200" : "border-tai-blue/[0.07]"
          )}>
            <span className="text-xs text-ink/35 font-mono">
              Hint Level: {message.hint_level}
            </span>
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className={cn(
            "mt-3 pt-3 border-t",
            isRefusal ? "border-amber-200" : "border-tai-blue/[0.07]"
          )}>
            <p className="text-xs font-medium text-ink/40 mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Sources
            </p>
            <ul className="space-y-1">
              {message.sources.map((source, index) => (
                <li
                  key={index}
                  className="text-xs text-ink/35 font-mono"
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
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 bg-tai-blue-light rounded text-xs font-mono text-tai-blue"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
