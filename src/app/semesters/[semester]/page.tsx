import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { CourseListSkeleton, SemesterSkeleton } from "@/components/site/skeletons";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { readForPage } from "@/lib/page-errors";
import { listCoursesBySemester } from "@/services/courses/courses";

// The four semesters are known at build time, so they are prerendered. Anything else (e.g. /semesters/9) renders the not-found
// page. dynamicParams = false would make that a 404 from routing, but Cache Components rejects it.
export function generateStaticParams() {
  return Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => ({
    semester: String(SEMESTER_MIN + i),
  }));
}

function parseSemester(param: string): number | null {
  if (!/^\d+$/.test(param)) return null;
  const semester = Number(param);
  return semester >= SEMESTER_MIN && semester <= SEMESTER_MAX ? semester : null;
}

export async function generateMetadata({ params }: PageProps<"/semesters/[semester]">): Promise<Metadata> {
  const semester = parseSemester((await params).semester);
  return { title: semester ? `Semester ${semester}` : "Not found" };
}

// The semester comes from `params`, which is URL data, so it is read inside Suspense. The
// fallback covers the breadcrumb and title too, since they depend on it.
export default function SemesterPage({ params }: PageProps<"/semesters/[semester]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<SemesterSkeleton />}>
        {params.then(({ semester }) => (
          <SemesterContent semester={semester} />
        ))}
      </Suspense>
    </main>
  );
}

function SemesterContent({ semester: param }: { semester: string }) {
  const semester = parseSemester(param);
  if (semester === null) notFound();

  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: `Semester ${semester}` }]} />
      <PageTitle>Semester {semester}</PageTitle>
      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList semester={semester} />
      </Suspense>
    </>
  );
}

// Viewer is always null for now: browsing needs no account.
async function CourseList({ semester }: { semester: number }) {
  const courses = await readForPage(() => listCoursesBySemester(null, semester));

  if (courses.length === 0) return <p>No courses yet for this semester.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {courses.map((course) => (
        <li key={course.code}>
          <Link
            href={`/courses/${course.code}`}
            className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <p className="font-mono text-xs font-medium text-link">{course.code}</p>
                <CardTitle className="text-base text-heading">{course.title}</CardTitle>
                <CardDescription>
                  {course.resourceCount} {course.resourceCount === 1 ? "resource" : "resources"}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
