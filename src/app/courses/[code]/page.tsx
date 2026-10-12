import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { CourseSkeleton } from "@/components/site/skeletons";
import { readForPage } from "@/lib/page-errors";
import { getCourseByCode } from "@/services/courses/courses";
import { ResourceTabs } from "./resource-tabs";

export const metadata: Metadata = { title: "Course" };

// Course codes come from the database and are unknown at build time, so the code is runtime
// data: reading it and the course happens inside Suspense, behind a skeleton.
export default function CoursePage({ params }: PageProps<"/courses/[code]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<CourseSkeleton />}>
        {params.then(({ code }) => (
          <CourseContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

// Viewer is always null for now: browsing needs no account.
async function CourseContent({ code }: { code: string }) {
  const course = await readForPage(() => getCourseByCode(null, code));

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
      ) : (
        <ResourceTabs groups={course.groups} />
      )}
    </>
  );
}
