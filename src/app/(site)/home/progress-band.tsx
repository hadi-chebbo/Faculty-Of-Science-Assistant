"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/site/progress-ring";
import { useProgressOverview } from "@/lib/progress-overview-client";
import { activeDaysText, courseLabel, percentOf, topCourses, type BandCourse } from "./progress-band-logic";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// "Your progress" on Home, for a signed-in student only. Home stays static: the browser loads the
// overview after the page shows, and nothing renders for a visitor or before the answer. Marked
// `data-personal` (e2e/auth.spec.ts leaves it out when comparing signed in and signed out).
export function ProgressBand() {
  const overview = useProgressOverview();
  if (!overview) return null;
  const courses = topCourses(overview.courses);
  const empty = overview.courses.length === 0;
  return (
    <section data-personal aria-labelledby="home-progress-title" className="rounded-xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-progress-title" className="text-base font-semibold text-heading">
          Your progress
        </h2>
        {!empty && (
          <Link
            href="/progress"
            className={`-my-2 -mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-sm font-medium text-link hover:underline ${FOCUS}`}
          >
            See all <ChevronRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      {empty ? (
        <>
          {overview.hasCompletions && <p className="mt-1 text-sm">{activeDaysText(overview.week.activeDays.length)}</p>}
          <p className="mt-1 text-sm text-muted-foreground">Mark files as done in the reader to track your progress here.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm">{activeDaysText(overview.week.activeDays.length)}</p>
          <ul className="mt-3 grid gap-1 md:grid-cols-3 md:gap-3">
            {courses.map((c) => (
              <li key={c.code} className="min-w-0">
                <CourseRow course={c} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CourseRow({ course: c }: { course: BandCourse }) {
  const examsOnly = c.course.total === 0;
  return (
    <Link
      href={`/courses/${c.code}`}
      aria-label={courseLabel(c)}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted md:border md:px-3 md:py-2.5 ${FOCUS}`}
    >
      <ProgressRing done={c.course.done} total={c.course.total} size={40} />
      <span className="block min-w-0 flex-1 text-sm">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[0.8125rem] font-medium text-link">{c.code}</span>
          <span className="truncate font-medium text-heading">{c.title}</span>
        </span>
        <span className="block truncate text-[0.8125rem] text-muted-foreground">
          {examsOnly ? (
            `Exams: ${c.exams.done} of ${c.exams.total} done`
          ) : c.course.finished ? (
            <span className="font-semibold text-success">✓ Finished</span>
          ) : (
            `${c.course.done} of ${c.course.total} files · ${percentOf(c.course.done, c.course.total)}%`
          )}
        </span>
      </span>
    </Link>
  );
}
