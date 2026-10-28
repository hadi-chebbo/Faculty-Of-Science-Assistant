import { Check, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/site/progress-ring";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";
import type { ProgressOverview } from "@/services/progress/types";

type CourseEntry = ProgressOverview["courses"][number];

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// My courses grouped by semester (the list arrives ordered by semester, then code). Server
// rendered: nothing here needs the browser.
export function ProgressOverviewList({ courses }: { courses: CourseEntry[] }) {
  if (courses.length === 0) {
    return (
      <StateBlock
        icon={TrendingUp}
        actions={
          <Button asChild className="h-11 px-5 md:h-9">
            <Link href="/">Browse courses</Link>
          </Button>
        }
      >
        Nothing marked as done yet. Open a file and press Mark as done to see your progress here.
      </StateBlock>
    );
  }
  const semesters = [...new Set(courses.map((c) => c.semester))];
  return (
    <div className="space-y-8">
      {semesters.map((semester) => (
        <section key={semester} aria-labelledby={`semester-${semester}`}>
          <h2 id={`semester-${semester}`} className="mb-3 text-xl font-semibold tracking-tight">
            Semester {semester}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {courses
              .filter((c) => c.semester === semester)
              .map((course) => (
                <CourseCard key={course.code} course={course} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CourseCard({ course }: { course: CourseEntry }) {
  const { code, title, course: files, exams } = course;
  const percent = files.total > 0 ? Math.floor((files.done / files.total) * 100) : 0;
  const ringLabel = `${percent}% done, ${files.done} of ${files.total} files`;
  const rows = [
    ...course.chapters.filter((c) => c.total > 0).map((c) => ({ key: c.id, label: `${c.position} · ${c.title}`, ...c })),
    ...(course.general.total > 0 ? [{ key: "general", label: "General", ...course.general }] : []),
  ];
  return (
    <li className={`rounded-xl border bg-card p-4 md:p-5 ${files.finished ? "border-success/50" : ""}`}>
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
          <h3 className="text-base font-semibold">
            <Link href={`/courses/${code}`} className={`rounded-sm text-link hover:underline ${FOCUS}`}>
              {code} {title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {files.finished && (
              <>
                <strong className="font-semibold text-success">Finished</strong> ·{" "}
              </>
            )}
            {files.done} of {files.total} files
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
        <ul className="mt-4 space-y-3 md:mt-5 md:space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3rem]"
            >
              <span className="truncate text-heading">{row.label}</span>
              <span aria-hidden className="order-3 col-span-2 block h-1.5 overflow-hidden rounded-full bg-border md:order-none md:col-span-1">
                <span
                  className={`block h-full rounded-full ${row.finished ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${Math.round((row.done / row.total) * 100)}%` }}
                />
              </span>
              {row.finished ? (
                <span className="inline-flex items-center justify-end gap-1 font-semibold tabular-nums text-success">
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
