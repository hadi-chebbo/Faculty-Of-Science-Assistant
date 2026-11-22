import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { CourseListSkeleton, YearSkeleton } from "@/components/site/skeletons";
import { readForPage } from "@/lib/page-errors";
import { YEARS, parseYear, type Year, semesterLabel, yearLabel, yearSlug } from "@/lib/years";
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
    <main className="page-container py-6 md:py-8">
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
      <PageTitle>{yearLabel(year)}</PageTitle>
      <Suspense fallback={<CourseListSkeleton />}>
        <Semesters year={year} />
      </Suspense>
    </>
  );
}

// Viewer is always null for now: browsing needs no account.
async function Semesters({ year }: { year: Year }) {
  const semesters = await readForPage(() => listCoursesByYear(null, year));

  return (
    <div className="space-y-8">
      {semesters.map((entry) => (
        <SemesterSection key={entry.semester} entry={entry} />
      ))}
    </div>
  );
}

function SemesterSection({ entry }: { entry: YearSemester }) {
  const label = semesterLabel(entry.semester);
  // The anchor is the number within the year ("semester-1"), never the stored 1-6 number.
  const id = label.toLowerCase().replace(" ", "-");
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 scroll-mt-20 text-xl font-semibold text-heading">
        {label}
      </h2>
      {entry.courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courses yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entry.courses.map((course) => (
            <li key={course.code} className="relative">
              <Link
                href={`/courses/${course.code}`}
                className="group flex h-full min-h-20 items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="min-w-0 pr-10">
                  <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-link">
                    {course.code}
                  </span>
                  <span className="mt-1.5 block text-base font-medium text-heading">{course.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {course.resourceCount} {course.resourceCount === 1 ? "resource" : "resources"}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-link"
                />
              </Link>
              <CourseProgressRing code={course.code} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
