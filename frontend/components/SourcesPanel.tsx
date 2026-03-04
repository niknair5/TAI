"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getCourseFiles, CourseFile } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ChevronLeft, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SourcesPanelProps {
  courseId: string;
  selectedFileIds: Set<string>;
  onSelectionChange: (fileIds: Set<string>) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;

export function SourcesPanel({ courseId, selectedFileIds, onSelectionChange }: SourcesPanelProps) {
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadFiles() {
      try {
        const courseFiles = await getCourseFiles(courseId);
        setFiles(courseFiles);
        // Select all files by default
        onSelectionChange(new Set(courseFiles.map((f) => f.id)));
      } catch (error) {
        console.error("Failed to load course files:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const toggleFile = (fileId: string) => {
    const next = new Set(selectedFileIds);
    if (next.has(fileId)) {
      next.delete(fileId);
    } else {
      next.add(fileId);
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (selectedFileIds.size === files.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map((f) => f.id)));
    }
  };

  // ---- Resize logic ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [panelWidth]);

  // Collapsed state — slim toggle bar
  if (isCollapsed) {
    return (
      <div className="shrink-0 border-r border-black/10 bg-white flex flex-col items-center py-3 w-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-ink/40 hover:text-tai-blue"
          onClick={() => setIsCollapsed(false)}
          title="Show sources"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="shrink-0 border-r border-black/10 bg-white flex flex-col relative select-none"
      style={{ width: panelWidth }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/50">Sources</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-ink/40 hover:text-tai-blue"
          onClick={() => setIsCollapsed(true)}
          title="Collapse panel"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Select all / none */}
      {files.length > 0 && (
        <div className="px-4 py-2 border-b border-black/5">
          <button
            onClick={toggleAll}
            className="text-xs text-tai-blue hover:text-tai-accent transition-colors font-medium"
          >
            {selectedFileIds.size === files.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-0.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-ink/30">
              <Loader2 className="w-5 h-5 animate-spin mb-2" />
              <span className="text-xs">Loading sources…</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <FileText className="w-8 h-8 text-ink/15 mb-2" />
              <p className="text-xs text-ink/35">No sources uploaded yet</p>
              <p className="text-xs text-ink/25 mt-1">Your instructor will upload course materials here</p>
            </div>
          ) : (
            files.map((file) => {
              const isSelected = selectedFileIds.has(file.id);
              return (
                <button
                  key={file.id}
                  onClick={() => toggleFile(file.id)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors group",
                    isSelected
                      ? "bg-tai-blue-light/70 hover:bg-tai-blue-light"
                      : "hover:bg-black/[0.03]"
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-tai-blue border-tai-blue"
                        : "border-black/20 group-hover:border-black/30"
                    )}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm truncate font-medium leading-snug",
                      isSelected ? "text-tai-blue" : "text-ink/60"
                    )}>
                      {file.filename}
                    </p>
                    <p className="text-[10px] text-ink/30 mt-0.5 font-mono">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Selection summary */}
      {files.length > 0 && (
        <div className="px-4 py-2.5 border-t border-black/5 bg-paper/50">
          <p className="text-[11px] text-ink/35">
            <span className="font-mono font-semibold text-tai-blue">{selectedFileIds.size}</span>
            {" "}of{" "}
            <span className="font-mono">{files.length}</span>
            {" "}source{files.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group/resize z-10 flex items-center justify-center hover:bg-tai-blue/10 transition-colors"
        title="Drag to resize"
      >
        <div className="w-0.5 h-8 rounded-full bg-black/10 group-hover/resize:bg-tai-blue/40 transition-colors" />
      </div>
    </div>
  );
}
