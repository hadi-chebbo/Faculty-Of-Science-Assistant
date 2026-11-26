"use client";

import { ProgressRing } from "@/components/site/progress-ring";
import { useProgressOverview } from "@/lib/progress-overview-client";

// A small ring on a course card for a signed-in student who has started the course. The card's
// wrapper is `relative` and the card keeps this top-right spot clear, so the ring appears without
// moving anything. Marked `data-personal`: e2e/auth.spec.ts leaves it out when it compares signed-in and signed-out pages.
export function CourseProgressRing({ code }: { code: string }) {
  const course = useProgressOverview()?.courses.find((c) => c.code === code);
  if (!course || course.course.total === 0) return null;
  const { done, total } = course.course;
  return (
    <span
      data-personal
      role="img"
      aria-label={`Your progress: ${Math.floor((done / total) * 100)}% done`}
      className="pointer-events-none absolute right-4 top-4"
    >
      <ProgressRing done={done} total={total} size={34} checkWhenFinished />
    </span>
  );
}
