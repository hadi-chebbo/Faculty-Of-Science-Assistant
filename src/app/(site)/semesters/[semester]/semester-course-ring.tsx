"use client";

import { ProgressRing } from "@/components/site/progress-ring";
import { useProgressOverview } from "@/lib/progress-overview-client";

// A small ring on a course card for a signed-in student who has started the course. The card is
// `relative` and keeps this spot clear, so the ring appears without moving anything. Marked
// `data-personal`: e2e/auth.spec.ts leaves it out when it compares signed-in and signed-out pages.
export function SemesterCourseRing({ code }: { code: string }) {
  const course = useProgressOverview()?.courses.find((c) => c.code === code);
  if (!course || course.course.total === 0) return null;
  const { done, total } = course.course;
  return (
    <span
      data-personal
      role="img"
      aria-label={`Your progress: ${Math.floor((done / total) * 100)}% done`}
      className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2"
    >
      <ProgressRing done={done} total={total} size={34} checkWhenFinished />
    </span>
  );
}
