"use client";

import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useState, useSyncExternalStore } from "react";
import { pulses } from "@/lib/celebrations";
import { useDoneResource } from "@/lib/completions-client";
import { cn } from "@/lib/utils";
import type { Progress } from "@/services/progress/types";

// "Mark as done" in the details column, after "Add to to-do"; a filled green "Done" once it is.
// Same state as the More actions menu. Shown only for lectures, notes, exercises and exams. While
// the answer is unknown it looks like "Mark as done", so nothing moves when it arrives.
export function MarkDoneButton({ resourceId, isExam }: { resourceId: string; isExam: boolean }) {
  const { status, pending, progress, toggle } = useDoneResource(resourceId);
  const done = status === "done";
  // A chapter finished: the ring plays once while the pulse count is ahead of the last one played.
  const pulse = useSyncExternalStore(pulses.subscribe, () => pulses.get().get(resourceId) ?? 0, () => 0);
  const [played, setPlayed] = useState(pulse);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={done ? "default" : "outline"}
        aria-pressed={done}
        disabled={pending}
        data-done-button={resourceId}
        onAnimationEnd={(event) => event.target === event.currentTarget && setPlayed(pulse)}
        onClick={() => void toggle()}
        className={cn("min-h-11 w-full md:min-h-9", done && "bg-success text-success-foreground hover:bg-success/90", pulse !== played && "done-ring")}
      >
        {done ? <Check aria-hidden /> : <Circle aria-hidden />}
        {done ? "Done" : "Mark as done"}
      </Button>
      {progress && <ProgressLine progress={progress} isExam={isExam} />}
    </div>
  );
}

// How far the student is where this file sits: its chapter, the exams for an exam, or the course
// for a file in General. Known once the file has been marked or un-marked on this page.
function ProgressLine({ progress, isExam }: { progress: Progress; isExam: boolean }) {
  const { label, done, total, finished } = isExam
    ? { label: "Exams", ...progress.exams, finished: progress.exams.total >= 1 && progress.exams.done === progress.exams.total }
    : progress.chapter
      ? { label: `Chapter ${progress.chapter.position}`, ...progress.chapter }
      : { label: progress.course.code, ...progress.course };
  if (total === 0) return null;
  return (
    <div className="px-0.5 text-[0.8125rem]">
      <p>
        {label}: <strong className="font-semibold text-heading">{done} of {total}</strong> {isExam ? "done" : "files done"}
      </p>
      <ProgressBar
        value={(done / total) * 100}
        aria-label={`${label}: ${done} of ${total} done`}
        className={cn("mt-1.5", finished && "[&>[data-slot=progress-indicator]]:bg-success")}
      />
    </div>
  );
}
