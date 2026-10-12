import { ArrowLeft, ArrowRight, FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { ResourceRow } from "@/components/site/resource-row";
import { CourseSkeleton } from "@/components/site/skeletons";
import { StateBlock } from "@/components/site/state-block";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { readForPage } from "@/lib/page-errors";
import { getChapterPage } from "@/services/courses/courses";
import type { ChapterLink } from "@/services/courses/types";

export const metadata: Metadata = { title: "Chapter" };

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const BUTTON = `inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-heading transition-colors hover:border-primary/40 ${FOCUS}`;

// Course codes and positions are runtime data: reading them and the chapter happens inside
// Suspense, behind a skeleton.
export default function ChapterPage({ params }: PageProps<"/courses/[code]/chapters/[position]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<CourseSkeleton />}>
        {params.then(({ code, position }) => (
          <ChapterContent code={code} position={position} />
        ))}
      </Suspense>
    </main>
  );
}

// Viewer is always null for now: browsing needs no account.
async function ChapterContent({ code, position }: { code: string; position: string }) {
  const { course, chapter, previous, next } = await readForPage(() => getChapterPage(null, code, position));
  const courseHref = `/courses/${encodeURIComponent(course.code)}`;
  const chapterHref = (c: ChapterLink) => `${courseHref}/chapters/${c.position}`;

  return (
    <>
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: `Semester ${course.semester}`, href: `/semesters/${course.semester}` },
          { label: course.code, href: courseHref },
          { label: `Chapter ${chapter.position}` },
        ]}
      />
      <PageTitle
        description={
          <span className="text-sm">
            Chapter {chapter.position} · <span className="font-mono text-link">{course.code}</span>
          </span>
        }
      >
        {chapter.title}
      </PageTitle>

      {chapter.groups.length === 0 ? (
        <StateBlock
          icon={FileQuestion}
          actions={
            <Link href={courseHref} className={BUTTON}>
              Back to the course
            </Link>
          }
        >
          Nothing here yet.
        </StateBlock>
      ) : (
        <div className="space-y-8">
          {chapter.groups.length >= 2 && (
            <nav aria-label="In this chapter" className="flex flex-wrap gap-x-1 text-sm">
              {chapter.groups.map((group, i) => (
                <span key={group.type} className="inline-flex items-center">
                  {i > 0 && (
                    <span aria-hidden className="mr-1 text-muted-foreground">
                      ·
                    </span>
                  )}
                  <a
                    href={`#${group.type}`}
                    className={`inline-flex min-h-11 items-center rounded-md px-2 text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
                  >
                    {RESOURCE_TYPE_LABELS[group.type]} {group.resources.length}
                  </a>
                </span>
              ))}
            </nav>
          )}
          {chapter.groups.map((group) => (
            <section key={group.type} id={group.type} aria-labelledby={`${group.type}-heading`} className="scroll-mt-20">
              <h2 id={`${group.type}-heading`} className="mb-3 text-lg font-semibold tracking-tight">
                {RESOURCE_TYPE_LABELS[group.type]}
              </h2>
              <ul className="space-y-2">
                {group.resources.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <nav aria-label="Chapters" className="mt-10 grid gap-3 border-t pt-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="sm:justify-self-start">
          {previous && (
            <Link href={chapterHref(previous)} className={`${BUTTON} w-full sm:w-auto`}>
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 text-left">
                <span className="block text-xs font-normal text-muted-foreground">Previous</span>
                <span className="block truncate">
                  Chapter {previous.position}: {previous.title}
                </span>
              </span>
            </Link>
          )}
        </div>
        <Link href={courseHref} className={`${BUTTON} justify-center`}>
          All chapters
        </Link>
        <div className="sm:justify-self-end">
          {next && (
            <Link href={chapterHref(next)} className={`${BUTTON} w-full justify-end sm:w-auto`}>
              <span className="min-w-0 text-right">
                <span className="block text-xs font-normal text-muted-foreground">Next</span>
                <span className="block truncate">
                  Chapter {next.position}: {next.title}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
