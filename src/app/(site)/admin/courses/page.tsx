import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { readForPage } from "@/lib/page-errors";
import { listAdminCourses } from "@/services/courses/admin";
import type { Viewer } from "@/services/viewer";
import { requireAdminPage } from "../guard";
import { EditCourseButton } from "./edit-course-button";
import { NewCourseCard } from "./new-course-card";

export const metadata: Metadata = { title: "Courses - Admin", robots: { index: false, follow: false } };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// Admin only, checked on the server before anything renders. Uncached (see next.config.ts).
export default function AdminCoursesPage() {
  return (
    <main className="page-container py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>}>
        <CoursesContent />
      </Suspense>
    </main>
  );
}

async function CoursesContent() {
  const { admin } = await requireAdminPage("/admin/courses");
  return (
    <>
      <AdminBar current="courses" />
      <PageTitle>Courses</PageTitle>
      <CourseList viewer={admin} />
    </>
  );
}

async function CourseList({ viewer }: { viewer: Viewer }) {
  const courses = await readForPage(() => listAdminCourses(viewer));
  const semesters = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => SEMESTER_MIN + i);
  return (
    <section className="space-y-6" aria-label="Courses">
      <NewCourseCard />
      <h2 className="text-lg font-semibold text-heading" aria-live="polite">{plural(courses.length, "course")}</h2>
      {semesters.map((semester) => {
        const inSemester = courses.filter((c) => c.semester === semester);
        return (
          <div key={semester} className="space-y-2">
            <h3 className="text-base font-semibold text-heading">Semester {semester}</h3>
            {inSemester.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {inSemester.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-heading">
                        {c.code} <span className="font-normal text-body">{c.title}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {plural(c.resourceCount, "resource")} · {plural(c.chapterCount, "chapter")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <EditCourseButton course={c} />
                      <Button asChild variant="outline" className="h-11 px-4 md:h-9 md:px-3">
                        <Link href={`/admin/chapters?course=${encodeURIComponent(c.code)}`}>Chapters</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 px-4 md:h-9 md:px-3">
                        <Link href={`/courses/${encodeURIComponent(c.code)}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
