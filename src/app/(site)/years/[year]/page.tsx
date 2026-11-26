import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { CourseListSkeleton, YearSkeleton } from "@/components/site/skeletons";
import { YearCircle } from "@/components/site/year-badge";
import { YEAR_STYLES } from "@/lib/design-language";
import { readForPage } from "@/lib/page-errors";
import { plural } from "@/lib/plural";
import { YEARS, parseYear, type Year, semesterAnchor, semesterLabel, yearLabel, yearSlug } from "@/lib/years";
import { listCoursesByYear, type YearSemester } from "@/services/courses/courses";
import { CourseProgressRing } from "./course-progress-ring";

// The years are known at build time, so they are prerendered. Anything else (e.g. /years/9) renders the not-found
// page. dynamicParams = false would make that a 404 from routing, but Cache Components rejects it.
export function generateStaticParams() {
  return YEARS.map((year) => ({ year: yearSlug(year) }));
}

export async function generateMetadata({ params }: PageProps<"/years/[year]">): Promise<Metadata> {
  const year = parseYear((await params).year);
  return { title: year ? yearLabel(year) : "Not found" };
}

// The year comes from `params`, which is URL data, so it is read inside Suspense. The
// fallback covers the breadcrumb and title too, since they depend on it. The page never reads the session.
export default function YearPage({ params }: PageProps<"/years/[year]">) {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container py-6 md:py-8">
      <Suspense fallback={<YearSkeleton />}>
        {params.then(({ year }) => (
          <YearContent year={year} />
        ))}
      </Suspense>
    </main>
  );
}

function YearContent({ year: param }: { year: string }) {
  const year = parseYear(param);
  if (year === null) notFound();

  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: yearLabel(year) }]} />
      <YearHeader year={year} />
      <Suspense fallback={<CourseListSkeleton />}>
        <Semesters year={year} />
      </Suspense>
    </>
  );
}

// The year's circle (its colour, as on the home cards) beside the title, then the short yellow bar every page title has.
function YearHeader({ year }: { year: Year }) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-4">
        <YearCircle year={year} className="size-12 text-base md:size-14 md:text-lg" />
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{yearLabel(year)}</h1>
      </div>
      <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
    </header>
  );
}

// Viewer is always null for now: browsing needs no account.
async function Semesters({ year }: { year: Year }) {
  const semesters = await readForPage(() => listCoursesByYear(null, year));

  return (
    <div className="space-y-10">
      {semesters.map((entry) => (
        <SemesterSection key={entry.semester} year={year} entry={entry} />
      ))}
    </div>
  );
}

function SemesterSection({ year, entry }: { year: Year; entry: YearSemester }) {
  const label = semesterLabel(entry.semester);
  const id = semesterAnchor(entry.semester);
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 id={id} className="scroll-mt-20 text-xl font-semibold text-heading">
          {label}
        </h2>
        {entry.courses.length > 0 && <span className="text-sm text-muted-foreground">{plural(entry.courses.length, "course")}</span>}
      </div>
      {entry.courses.length === 0 ? (
        <p className="rounded-3xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">No courses yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entry.courses.map((course, index) => (
            <li
              key={course.code}
              style={{ "--rise-delay": `${Math.min(index, 8) * 50}ms` } as React.CSSProperties}
              className="rise-in relative"
            >
              {course.resourceCount === 0 ? <EmptyCourseCard course={course} /> : <CourseCard year={year} course={course} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type YearCourse = YearSemester["courses"][number];

// A course with no visible file: muted and dashed, not a link, no ring.
function EmptyCourseCard({ course }: { course: YearCourse }) {
  return (
    <div className="flex h-full min-h-36 flex-col rounded-3xl border border-dashed bg-muted/40 p-5 text-muted-foreground">
      <span className="w-fit rounded-lg bg-muted px-2 py-0.5 font-mono text-xs font-semibold">{course.code}</span>
      <span className="mt-3 text-lg font-semibold leading-snug">{course.title}</span>
      <span className="mt-auto pt-4 text-sm">No files yet</span>
    </div>
  );
}

// The code chip and the arrow take the year's tint, the hover border its colour; the card lifts on hover only when
// motion is welcome. The top right stays clear for the signed-in progress ring, so it appears without moving anything.
function CourseCard({ year, course }: { year: Year; course: YearCourse }) {
  const style = YEAR_STYLES[year];
  return (
    <>
      <Link
        href={`/courses/${course.code}`}
        className={`group flex h-full min-h-36 flex-col rounded-3xl border bg-card p-5 transition-[transform,border-color,box-shadow] hover:shadow-md motion-safe:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${style.border}`}
      >
        <span className={`w-fit rounded-lg px-2 py-0.5 font-mono text-xs font-semibold ${style.chip}`}>{course.code}</span>
        <span className="mt-3 pr-10 text-lg font-semibold leading-snug text-heading">{course.title}</span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
          <span>{plural(course.resourceCount, "resource")}</span>
          <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full ${style.chip}`}>
            <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
      <CourseProgressRing code={course.code} />
    </>
  );
}
