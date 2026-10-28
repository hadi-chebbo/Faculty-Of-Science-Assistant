"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/site/progress-ring";
import { useCourseProgress } from "@/lib/course-progress-client";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The course page header's progress block, for a signed-in student only. It is positioned out of
// the flow (on a phone at the right of the course code line, from md up at the right of the title)
// and the title keeps room for it, so it appears without moving anything. Links to /progress.
export function CourseProgressBlock({ code }: { code: string }) {
  const progress = useCourseProgress(code);
  if (!progress || progress.course.total === 0) return null;
  const { course, exams } = progress;
  const percent = Math.floor((course.done / course.total) * 100);
  const label =
    `Your progress: ${percent}% done, ${course.done} of ${course.total} files.` +
    (exams.total > 0 ? ` Exams: ${exams.done} of ${exams.total} done.` : "");
  return (
    <>
      <Link
        href="/progress"
        aria-label={label}
        className={`absolute bottom-3.5 right-0 flex size-11 items-center justify-center rounded-full md:hidden ${FOCUS}`}
      >
        <ProgressRing done={course.done} total={course.total} size={44} />
      </Link>
      <div className="absolute inset-y-0 right-0 bottom-6 hidden items-center md:flex">
        <Link
          href="/progress"
          aria-label={label}
          className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary ${FOCUS}`}
        >
          <ProgressRing done={course.done} total={course.total} size={56} />
          <span className="block text-sm text-muted-foreground">
            <span className="block font-semibold text-heading">Your progress</span>
            <span className="block">
              {course.done} of {course.total} files done
            </span>
            {exams.total > 0 && (
              <span className="block">
                Exams: {exams.done} of {exams.total} done
              </span>
            )}
          </span>
        </Link>
      </div>
    </>
  );
}

// What a chapter card shows at the right of its "Chapter N" line. Nothing for a visitor, while
// loading, or for a chapter with no counted files.
export function ChapterProgressText({ code, position }: { code: string; position: number }) {
  const chapter = useCourseProgress(code)?.chapters.find((c) => c.position === position);
  if (!chapter || chapter.total === 0) return null;
  if (chapter.finished) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-success">
        <Check aria-hidden className="size-3.5" /> Finished
      </span>
    );
  }
  return (
    <span className="shrink-0 font-normal text-muted-foreground">
      {chapter.done === 0 ? `Not started · ${chapter.total} ${chapter.total === 1 ? "file" : "files"}` : `${chapter.done} of ${chapter.total} done`}
    </span>
  );
}

// The 4px bar along the card's bottom edge. The card must be `relative overflow-hidden`; the bar
// takes no height. `data-finished` lets the card tint its border (`has-[...]`). Decorative: the
// text above says the same.
export function ChapterProgressBar({ code, position }: { code: string; position: number }) {
  const chapter = useCourseProgress(code)?.chapters.find((c) => c.position === position);
  if (!chapter || chapter.total === 0) return null;
  return (
    <span aria-hidden data-finished={chapter.finished} className="absolute inset-x-0 bottom-0 block h-1 bg-border">
      <span
        className={`block h-full ${chapter.finished ? "bg-success" : "bg-primary"}`}
        style={{ width: `${Math.round((chapter.done / chapter.total) * 100)}%` }}
      />
    </span>
  );
}
