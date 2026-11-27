import { Check, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/site/progress-ring";
import { YearCircle } from "@/components/site/year-badge";
import { YEAR_STYLES } from "@/lib/design-language";
import { Button } from "@/components/ui/button";
import { groupCoursesByYear } from "./group-by-year";
import { semesterLabel, yearLabel, type Year } from "@/lib/years";
import type { ProgressOverview } from "@/services/progress/types";
import { filesOf } from "@/lib/plural";

type CourseEntry = ProgressOverview["courses"][number];

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// My courses grouped by year, then semester, then code. Server
// rendered: nothing here needs the browser.
export function ProgressOverviewList({ courses }: { courses: CourseEntry[] }) {
  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border bg-card px-4 py-10 text-center md:py-14">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <TrendingUp className="size-7" aria-hidden />
        </span>
        <p className="mt-4 max-w-md">Nothing marked as done yet. Open a file and press Mark as done to see your progress here.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild className="h-11 px-5 md:h-9">
            <Link href="/">Browse courses</Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {groupCoursesByYear(courses).map((group) => (
        <section key={group.year} aria-labelledby={`year-${group.year}`}>
          <div className="mb-3 flex items-center gap-2.5">
            <YearCircle year={group.year} className="size-7 text-[13px]" />
            <h2 id={`year-${group.year}`} className="text-xl font-semibold tracking-tight">
              {yearLabel(group.year)}
            </h2>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {group.courses.map((course) => (
              <CourseCard key={course.code} course={course} year={group.year} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CourseCard({ course, year }: { course: CourseEntry; year: Year }) {
  const { code, title, course: files, exams } = course;
  const percent = files.total > 0 ? Math.floor((files.done / files.total) * 100) : 0;
  const ringLabel = `${percent}% done, ${filesOf(files.done, files.total)}`;
  const rows = [
    ...course.chapters.filter((c) => c.total > 0).map((c) => ({ key: c.id, label: `${c.position} · ${c.title}`, ...c })),
    ...(course.general.total > 0 ? [{ key: "general", label: "General", ...course.general }] : []),
  ];
  return (
    <li className={`rounded-3xl border bg-card p-5 ${files.finished ? "border-success/50" : ""}`}>
      <div className="flex items-center gap-3 md:gap-4">
        <div role="img" aria-label={ringLabel} className="shrink-0">
          <span className="md:hidden">
            <ProgressRing done={files.done} total={files.total} size={56} checkWhenFinished />
          </span>
          <span className="hidden md:block">
            <ProgressRing done={files.done} total={files.total} size={64} checkWhenFinished />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{semesterLabel(course.semester)}</p>
          <h3 className="text-base font-semibold leading-snug">
            <Link href={`/courses/${code}`} className={`block rounded-sm py-3 text-heading hover:underline md:py-1 ${FOCUS}`}>
              <span className={`inline-flex h-[22px] items-center rounded-full px-2 align-middle text-xs font-medium ${YEAR_STYLES[year].chip}`}>{code}</span>{" "}
              {title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {files.finished && (
              <>
                <strong className="font-semibold text-success">Finished</strong> ·{" "}
              </>
            )}
            {filesOf(files.done, files.total)}
            {exams.total > 0 && (
              <>
                <span aria-hidden className="hidden md:inline">
                  {" "}
                  ·{" "}
                </span>
                <span className="block md:inline">Exams: {exams.done} of {exams.total} done</span>
              </>
            )}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-3 border-t pt-4 md:space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm md:grid-cols-[minmax(0,1fr)_120px_44px]"
            >
              <span className="truncate text-heading">{row.label}</span>
              <span aria-hidden className="order-3 col-span-2 block h-1.5 overflow-hidden rounded-full bg-border md:order-none md:col-span-1">
                <span
                  className={`block h-full rounded-full ${row.finished ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${Math.round((row.done / row.total) * 100)}%` }}
                />
              </span>
              {row.finished ? (
                <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap font-semibold tabular-nums text-success">
                  <Check aria-hidden className="size-3.5" /> {row.done}/{row.total}
                </span>
              ) : (
                <span className="text-right tabular-nums text-muted-foreground">
                  {row.done}/{row.total}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
