"use client";

import { Button } from "@/components/ui/button";
import { Lightbulb, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HintControlsProps {
  onRequestHint: (type: "concept" | "hint" | "more") => void;
  currentHintLevel: number;
  disabled: boolean;
  hasMessages: boolean;
}

export function HintControls({
  onRequestHint,
  currentHintLevel,
  disabled,
  hasMessages,
}: HintControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onRequestHint("concept")}
        disabled={disabled}
        className="gap-1.5 text-xs"
      >
        <BookOpen className="w-3.5 h-3.5" />
        Explain Concept
      </Button>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onRequestHint("hint")}
        disabled={disabled}
        className="gap-1.5 text-xs"
      >
        <Lightbulb className="w-3.5 h-3.5" />
        Give Hint
      </Button>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onRequestHint("more")}
        disabled={disabled || !hasMessages || currentHintLevel >= 3}
        className="gap-1.5 text-xs"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        Another Hint
      </Button>

      {/* Hint Level Indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-ink/35 font-mono">Level</span>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                level <= currentHintLevel
                  ? "bg-tai-accent"
                  : "bg-ink/10"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
