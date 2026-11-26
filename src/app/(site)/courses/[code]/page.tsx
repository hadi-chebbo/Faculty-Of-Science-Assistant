import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/site/back-link";
import { Crumbs } from "@/components/site/crumbs";
import { CourseSkeleton } from "@/components/site/skeletons";
import { YearCircle } from "@/components/site/year-badge";
import { YEAR_STYLES } from "@/lib/design-language";
import { NOT_FOUND_TITLE, courseTitle, pageMetadata } from "@/lib/page-title";
import { courseYearSemesterLabel, yearCrumb, yearOfSemester } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { getCourseByCode, getCourseTitle } from "@/services/courses/courses";
import { AreaSwitch, ChapterCards, areaCounts, ExamsArea, OtherArea, parseArea } from "./course-areas";
import { CourseProgressBlock } from "./course-progress";
import { ResourceTabs } from "./resource-tabs";
import { ShowingOnly, TaughtBy } from "./taught-by";

// The tab title is the course, "CODE Title"; an unknown code keeps the generic title.
export async function generateMetadata({ params }: PageProps<"/courses/[code]">): Promise<Metadata> {
  const { code } = await params;
  await connection();
  const course = await getCourseTitle(code);
  return course ? pageMetadata(courseTitle(course)) : { title: NOT_FOUND_TITLE };
}

// Course codes come from the database and are unknown at build time, so the code is runtime
// data: reading it and the course happens inside Suspense, behind a skeleton.
export default function CoursePage({ params, searchParams }: PageProps<"/courses/[code]">) {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container py-6 md:py-8">
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

  const yearLink = yearCrumb(course.semester);
  const year = yearOfSemester(course.semester);

  return (
    <>
      <BackLink href={yearLink.href} label={`Back to ${yearLink.label}`}>
        {yearLink.label}
      </BackLink>
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          yearLink,
          { label: course.code },
        ]}
      />
      {/* The progress block is out of the flow and the title keeps room for it from md up (on a phone the code line is
          44px tall for its ring), so it appears without moving the title. */}
      <header className="relative mb-6">
        <div className="md:pr-80">
          <p className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <YearCircle year={year} className="size-6 text-xs" />
            {courseYearSemesterLabel(course.semester)}
          </p>
          <h1 className="flex flex-col items-start text-2xl font-semibold tracking-tight md:mt-2.5 md:flex-row md:items-center md:gap-3 md:text-3xl">
            <span className="flex min-h-11 items-center md:min-h-0">
              <span className={`rounded-full px-3 py-1 font-mono text-sm font-semibold md:text-base ${YEAR_STYLES[year].chip}`}>
                {course.code}
              </span>
            </span>
            <span>{course.title}</span>
          </h1>
          <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
        </div>
        <CourseProgressBlock code={course.code} />
      </header>
      {course.groups.length === 0 ? (
        <p>No resources yet for this course.</p>
      ) : !hasChapters ? (
        <>
          <TaughtBy path={path} scope={course} />
          <ShowingOnly path={path} lecturer={course.lecturer} />
          {/* Keyed by lecturer so the tab state starts over with the narrowed groups. */}
          <ResourceTabs key={applied ?? "all"} year={year} groups={course.groups} />
        </>
      ) : (
        <>
          <TaughtBy path={path} tab={area === "chapters" ? null : area} scope={course} />
          <AreaSwitch area={area} hasOther={hasOther} path={path} lecturer={applied} year={year} counts={areaCounts(outline)} />
          <ShowingOnly path={path} tab={area === "chapters" ? null : area} lecturer={course.lecturer} />
          {area === "chapters" && <ChapterCards year={year} code={course.code} chapters={outline.chapters} lecturer={course.lecturer} />}
          {area === "exams" && <ExamsArea code={course.code} exams={outline.exams} lecturer={course.lecturer} />}
          {area === "other" && <OtherArea groups={outline.general} lecturer={course.lecturer} />}
        </>
      )}
    </>
  );
}
