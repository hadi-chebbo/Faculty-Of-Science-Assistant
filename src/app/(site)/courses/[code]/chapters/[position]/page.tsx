import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/site/back-link";
import { Crumbs } from "@/components/site/crumbs";
import { CourseSkeleton } from "@/components/site/skeletons";
import { StateBlock } from "@/components/site/state-block";
import { TYPE_STYLES, YEAR_STYLES } from "@/lib/design-language";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { NOT_FOUND_TITLE, chapterTitle, pageMetadata } from "@/lib/page-title";
import { yearCrumb, yearOfSemester } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { getChapterPage, getChapterTitle } from "@/services/courses/courses";
import type { ChapterLink } from "@/services/courses/types";
import { TypeSection } from "../../course-areas";
import { ChapterProgressHeader } from "../../course-progress";
import { ShowingOnly, TaughtBy, pageHref } from "../../taught-by";

// The tab title is "CODE · Chapter N: Title"; an unknown course or chapter gets the not-found title.
export async function generateMetadata({
  params,
}: PageProps<"/courses/[code]/chapters/[position]">): Promise<Metadata> {
  const { code, position } = await params;
  await connection();
  const found = await getChapterTitle(code, position);
  return found ? pageMetadata(chapterTitle(found.course, found.chapter)) : { title: NOT_FOUND_TITLE };
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const BUTTON = `inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium text-heading transition-colors hover:border-primary/40 ${FOCUS}`;
const NAV_CARD = `flex min-h-11 h-full items-center gap-3 rounded-2xl border bg-card px-5 py-4 text-sm transition-colors hover:border-primary/40 ${FOCUS}`;

// Course codes and positions are runtime data: reading them and the chapter happens inside
// Suspense, behind a skeleton.
export default function ChapterPage({ params, searchParams }: PageProps<"/courses/[code]/chapters/[position]">) {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container py-6 md:py-8">
      <Suspense fallback={<CourseSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ code, position }, query]) => (
          <ChapterContent code={code} position={position} lecturer={query.lecturer} />
        ))}
      </Suspense>
    </main>
  );
}

// Viewer is always null for now: browsing needs no account.
async function ChapterContent({
  code,
  position,
  lecturer: rawLecturer,
}: {
  code: string;
  position: string;
  lecturer: string | string[] | undefined;
}) {
  const page = await readForPage(() =>
    getChapterPage(null, code, position, { lecturer: Array.isArray(rawLecturer) ? rawLecturer[0] : rawLecturer }),
  );
  const { course, chapter, previous, next, lecturer } = page;
  const slug = lecturer?.slug ?? null;
  const year = yearOfSemester(course.semester);
  // The chosen lecturer travels with the course, chapter, Previous and Next links.
  const courseHref = pageHref(`/courses/${encodeURIComponent(course.code)}`, { lecturer: slug });
  const chapterPath = `/courses/${encodeURIComponent(course.code)}/chapters/${chapter.position}`;
  const chapterHref = (c: ChapterLink) =>
    pageHref(`/courses/${encodeURIComponent(course.code)}/chapters/${c.position}`, { lecturer: slug });

  return (
    <>
      <BackLink href={courseHref} label={`Back to ${course.code}`}>
        <span className="font-mono">{course.code}</span>
      </BackLink>
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          yearCrumb(course.semester),
          { label: course.code, href: courseHref },
          { label: `Chapter ${chapter.position}` },
        ]}
      />
      {/* From md up the progress sits out of the flow at the right and the title keeps room for it. On a phone it sits
          under the title in a slot kept only when the signed-in hint is set (html[data-signed-in]), so a visitor's page
          has no gap and a student's does not move when it arrives. */}
      <header className="relative mb-6">
        <div className="md:pr-80">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${YEAR_STYLES[year].chip}`}>{course.code}</span>
            <span>
              {course.title} · Chapter {chapter.position}
            </span>
          </p>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight md:text-3xl">{chapter.title}</h1>
          <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
        </div>
        <div className="mt-4 flex items-end empty:hidden [html[data-signed-in]_&]:flex [html[data-signed-in]_&]:min-h-10 md:absolute md:inset-y-0 md:right-0 md:mt-0 md:w-72 md:pb-1 md:[html[data-signed-in]_&]:min-h-0">
          <ChapterProgressHeader code={course.code} position={chapter.position} />
        </div>
      </header>

      <TaughtBy path={chapterPath} scope={page} />
      <ShowingOnly path={chapterPath} lecturer={lecturer} />

      {chapter.groups.length === 0 ? (
        <StateBlock
          icon={FileQuestion}
          actions={
            lecturer ? (
              <Link href={chapterPath} className={BUTTON}>
                Show all files
              </Link>
            ) : (
              <Link href={courseHref} className={BUTTON}>
                Back to the course
              </Link>
            )
          }
        >
          {lecturer ? `No files by ${lecturer.name} in this chapter.` : "Nothing here yet."}
        </StateBlock>
      ) : (
        <div className="space-y-8">
          {chapter.groups.length >= 2 && (
            // Jump links in each type's colour; the words name the type and its count.
            <nav aria-label="In this chapter" className="flex flex-wrap gap-2">
              {chapter.groups.map((group) => (
                <a
                  key={group.type}
                  href={`#${group.type}`}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-opacity hover:opacity-80 md:min-h-9 ${TYPE_STYLES[group.type].chip} ${FOCUS}`}
                >
                  {RESOURCE_TYPE_LABELS[group.type]} {group.resources.length}
                </a>
              ))}
            </nav>
          )}
          {chapter.groups.map((group) => (
            <TypeSection key={group.type} id={group.type} group={group} />
          ))}
        </div>
      )}

      <nav aria-label="Chapters" className="mt-10 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-4">
        <div className="empty:hidden sm:empty:block">
          {previous && (
            <Link href={chapterHref(previous)} className={NAV_CARD}>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 text-left">
                <span className="block text-xs text-muted-foreground">Previous · Chapter {previous.position}</span>
                <span className="block truncate font-semibold text-heading">{previous.title}</span>
              </span>
            </Link>
          )}
        </div>
        <Link href={courseHref} className={`${NAV_CARD} justify-center font-semibold text-heading sm:w-48`}>
          All chapters
        </Link>
        <div className="empty:hidden sm:empty:block">
          {next && (
            <Link href={chapterHref(next)} className={`${NAV_CARD} justify-end`}>
              <span className="min-w-0 text-right">
                <span className="block text-xs text-muted-foreground">Next · Chapter {next.position}</span>
                <span className="block truncate font-semibold text-heading">{next.title}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
