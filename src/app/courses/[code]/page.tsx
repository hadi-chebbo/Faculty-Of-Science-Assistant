import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { CourseSkeleton } from "@/components/site/skeletons";
import { readForPage } from "@/lib/page-errors";
import { getCourseByCode } from "@/services/courses/courses";
import { CourseOutlineView, ViewSwitch, parseView, type CourseView } from "./course-outline";
import { ResourceTabs } from "./resource-tabs";

export const metadata: Metadata = { title: "Course" };

// Course codes come from the database and are unknown at build time, so the code is runtime
// data: reading it and the course happens inside Suspense, behind a skeleton.
export default function CoursePage({ params, searchParams }: PageProps<"/courses/[code]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<CourseSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ code }, query]) => (
          <CourseContent code={code} view={parseView(query.view)} />
        ))}
      </Suspense>
    </main>
  );
}

// Viewer is always null for now: browsing needs no account.
async function CourseContent({ code, view }: { code: string; view: CourseView }) {
  const course = await readForPage(() => getCourseByCode(null, code));
  const hasChapters = course.outline.chapters.length > 0;

  return (
    <>
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: `Semester ${course.semester}`, href: `/semesters/${course.semester}` },
          { label: course.code },
        ]}
      />
      <PageTitle description={<span className="font-mono text-sm text-link">{course.code}</span>}>
        {course.title}
      </PageTitle>
      {course.groups.length === 0 ? (
        <p>No resources yet for this course.</p>
      ) : !hasChapters ? (
        <ResourceTabs groups={course.groups} />
      ) : (
        <>
          <ViewSwitch view={view} />
          {view === "type" ? (
            <ResourceTabs groups={course.groups} />
          ) : (
            <CourseOutlineView code={course.code} outline={course.outline} />
          )}
        </>
      )}
    </>
  );
}
