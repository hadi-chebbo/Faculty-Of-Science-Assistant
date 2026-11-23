import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { CourseSkeleton } from "@/components/site/skeletons";
import { courseTitle, pageMetadata } from "@/lib/page-title";
import { yearCrumb } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { getCourseByCode } from "@/services/courses/courses";
import { AreaSwitch, ChapterCards, ExamsArea, OtherArea, parseArea } from "./course-areas";
import { CourseProgressBlock } from "./course-progress";
import { ResourceTabs } from "./resource-tabs";
import { ShowingOnly, TaughtBy } from "./taught-by";

// The tab title is the course, "CODE Title"; an unknown code keeps the generic title.
export async function generateMetadata({ params }: PageProps<"/courses/[code]">): Promise<Metadata> {
  const { code } = await params;
  await connection();
  const course = await getCourseByCode(null, code).catch(() => null);
  return course ? pageMetadata(courseTitle(course)) : { title: "Course" };
}

// Course codes come from the database and are unknown at build time, so the code is runtime
// data: reading it and the course happens inside Suspense, behind a skeleton.
export default function CoursePage({ params, searchParams }: PageProps<"/courses/[code]">) {
  return (
    <main className="page-container py-6 md:py-8">
      <Suspense fallback={<CourseSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ code }, query]) => (
          <CourseContent code={code} tab={query.tab} lecturer={query.lecturer} />
        ))}
      </Suspense>
    </main>
  );
}

// Viewer is always null for now: browsing needs no account.
async function CourseContent({
  code,
  tab,
  lecturer,
}: {
  code: string;
  tab: string | string[] | undefined;
  lecturer: string | string[] | undefined;
}) {
  const course = await readForPage(() =>
    getCourseByCode(null, code, { lecturer: Array.isArray(lecturer) ? lecturer[0] : lecturer }),
  );
  const { outline } = course;
  const hasChapters = course.hasChapters;
  const hasOther = course.hasOtherMaterial;
  const area = parseArea(tab, hasOther);
  const path = `/courses/${encodeURIComponent(course.code)}`;
  const applied = course.lecturer?.slug ?? null;

  return (
    <>
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          yearCrumb(course.semester),
          { label: course.code },
        ]}
      />
      {/* The progress block is out of the flow and the title keeps room for it from md up, so it
          appears without moving the title. */}
      <div className="relative">
        <div className="md:pr-80">
          <PageTitle description={<span className="font-mono text-sm text-link">{course.code}</span>}>
            {course.title}
          </PageTitle>
        </div>
        <CourseProgressBlock code={course.code} />
      </div>
      {course.groups.length === 0 ? (
        <p>No resources yet for this course.</p>
      ) : !hasChapters ? (
        <>
          <TaughtBy path={path} scope={course} />
          <ShowingOnly path={path} lecturer={course.lecturer} />
          {/* Keyed by lecturer so the tab state starts over with the narrowed groups. */}
          <ResourceTabs key={applied ?? "all"} groups={course.groups} />
        </>
      ) : (
        <>
          <TaughtBy path={path} tab={area === "chapters" ? null : area} scope={course} />
          <AreaSwitch area={area} hasOther={hasOther} path={path} lecturer={applied} />
          <ShowingOnly path={path} tab={area === "chapters" ? null : area} lecturer={course.lecturer} />
          {area === "chapters" && <ChapterCards code={course.code} chapters={outline.chapters} lecturer={course.lecturer} />}
          {area === "exams" && <ExamsArea code={course.code} exams={outline.exams} lecturer={course.lecturer} />}
          {area === "other" && <OtherArea groups={outline.general} lecturer={course.lecturer} />}
        </>
      )}
    </>
  );
}
