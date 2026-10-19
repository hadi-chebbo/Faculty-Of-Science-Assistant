import { ChevronRight, SearchX } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { Highlighted } from "@/components/site/highlighted";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import type { ExamSession, ResourceType } from "@/db/constants";
import { markText, snippetAround } from "@/lib/highlight";
import { RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { readForPage } from "@/lib/page-errors";
import { cn } from "@/lib/utils";
import { SEARCH_CHIPS, type SearchChip } from "@/services/search/query";
import type { SearchSection } from "@/services/search/schemas";
import { searchCatalog } from "@/services/search/search";
import type { ChapterHit, CourseHit, FileHit, SearchFilters, SearchOutcome } from "@/services/search/types";
import { searchHref, type SearchParams } from "./params";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const CARD = "overflow-hidden rounded-xl border bg-card";
const ROW_LINK = `group/hit flex items-center gap-3 px-4 py-3 hover:bg-muted/60 focus-visible:bg-muted/60 ${FOCUS}`;
const CHIP_LABELS: Record<SearchChip, string> = {
  all: "All",
  course: "Courses",
  lecture: "Lectures & notes",
  exercise: "Exercises",
  exam: "Exams",
};

const SEMESTERS = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => SEMESTER_MIN + i);

// What shows before there is a query to search for (fewer than two characters).
export function SearchHints() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed">
        Try a course code (<b className="font-semibold text-heading">DEMO301</b>), a topic (<b className="font-semibold text-heading">graphs</b>), or an exam (
        <b className="font-semibold text-heading">final 2024</b>). Accents don&apos;t matter.
      </p>
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Or browse a semester</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEMESTERS.map((semester) => (
            <li key={semester}>
              <Link
                href={`/semesters/${semester}`}
                className={`flex min-h-12 items-center rounded-lg border bg-card px-4 font-semibold text-heading transition-colors hover:border-primary/40 hover:bg-muted/60 ${FOCUS}`}
              >
                Semester {semester}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Viewer is always null: searching needs no account and the page never reads the session.
export async function SearchResults({ params }: { params: SearchParams }) {
  const outcome = await readForPage(() =>
    searchCatalog(params.q, { type: params.type, show: params.show, page: params.page }),
  );
  if (outcome.state === "short") return <SearchHints />;

  const groups = [outcome.courses, outcome.chapters, outcome.files];
  const empty = groups.every((g) => g === null || g.total === 0);
  return (
    <div className="space-y-5">
      <Chips outcome={outcome} params={params} />
      {empty ? <NoResults outcome={outcome} params={params} /> : <Found outcome={outcome} params={params} />}
    </div>
  );
}

// ----- chips

function Chips({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  // "All" is written into the address only when the words of the query would otherwise select a chip.
  return (
    <nav aria-label="Result types" className="-mx-4">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {SEARCH_CHIPS.map((chip) => {
          const active = outcome.chip === chip;
          const type = chip === "all" ? (outcome.impliedChip !== "all" ? "all" : undefined) : chip;
          return (
            <li key={chip} className="shrink-0">
              <Link
                href={searchHref({ q: params.q, type })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors md:min-h-9",
                  FOCUS,
                  active
                    ? "border-primary bg-primary font-semibold text-primary-foreground"
                    : "bg-card text-heading hover:border-primary/40 hover:bg-muted/60",
                )}
              >
                {CHIP_LABELS[chip]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ----- the words that act as filters

const TYPE_NOUNS: Record<ResourceType, string> = {
  lecture: "lectures",
  notes: "notes",
  exercise: "exercises",
  exam: "exams",
  solution: "solutions",
  other: "other files",
};
const SESSION_WORDS: Record<ExamSession, string> = { partial: "partial", final: "final", second: "second session" };

const joinWords = (words: string[]) => (words.length < 3 ? words.join(" or ") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`);

// "Showing final exams from 2024-2025 · 3 results": the filters found in the words of the query.
function FilterLine({ filters, total }: { filters: SearchFilters; total: number }) {
  const sessions = filters.sessions.map((s) => SESSION_WORDS[s]);
  const noun = filters.types.length > 0 ? joinWords(filters.types.map((t) => TYPE_NOUNS[t])) : "files";
  const nounOnly = sessions.length === 0 && filters.year === null;
  return (
    <p className="text-sm" aria-live="polite">
      Showing{" "}
      {sessions.length > 0 && (
        <>
          <b className="font-semibold text-heading">{joinWords(sessions)}</b>{" "}
        </>
      )}
      {nounOnly ? <b className="font-semibold text-heading">{noun}</b> : noun}
      {filters.year !== null && (
        <>
          {" "}
          from <b className="font-semibold text-heading">{formatAcademicYear(filters.year)}</b>
        </>
      )}{" "}
      · {total} {total === 1 ? "result" : "results"}
    </p>
  );
}

// ----- results

function Found({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  const hasFilters = outcome.filters.types.length > 0 || outcome.filters.sessions.length > 0 || outcome.filters.year !== null;
  const total = (outcome.courses?.total ?? 0) + (outcome.chapters?.total ?? 0) + (outcome.files?.total ?? 0);
  return (
    <>
      {hasFilters ? (
        <FilterLine filters={outcome.filters} total={outcome.files?.total ?? 0} />
      ) : (
        <p className="sr-only" aria-live="polite">
          {total} {total === 1 ? "result" : "results"}
        </p>
      )}
      {outcome.show && (
        <Link href={searchHref({ q: params.q, type: params.type })} className={`inline-flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:underline ${FOCUS}`}>
          &larr; All results
        </Link>
      )}
      {outcome.courses && outcome.courses.total > 0 && (
        <Section title="Courses" total={outcome.courses.total}>
          <ul className="space-y-2">
            {outcome.courses.items.map((course) => (
              <CourseCard key={course.code} course={course} terms={outcome.highlight} />
            ))}
          </ul>
          <ShowAll section="courses" shown={outcome.courses.items.length} total={outcome.courses.total} noun="courses" outcome={outcome} params={params} />
        </Section>
      )}
      {outcome.chapters && outcome.chapters.total > 0 && (
        <Section title="Chapters" total={outcome.chapters.total}>
          <ul className={cn(CARD, "divide-y")}>
            {outcome.chapters.items.map((chapter) => (
              <ChapterRow key={`${chapter.courseCode}/${chapter.position}`} chapter={chapter} terms={outcome.highlight} />
            ))}
          </ul>
          <ShowAll section="chapters" shown={outcome.chapters.items.length} total={outcome.chapters.total} noun="chapters" outcome={outcome} params={params} />
        </Section>
      )}
      {outcome.files && outcome.files.total > 0 && (
        <Section title="Files" total={outcome.files.total}>
          <ul className="space-y-2">
            {outcome.files.items.map((hit) => (
              <FileRow key={hit.resource.id} hit={hit} terms={outcome.highlight} />
            ))}
          </ul>
          <ShowAll section="files" shown={outcome.files.items.length} total={outcome.files.total} noun="files" outcome={outcome} params={params} />
        </Section>
      )}
      {outcome.show && outcome.pages > 1 && <Pager outcome={outcome} params={params} />}
    </>
  );
}

function Section({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} · {total}
      </h2>
      {children}
    </section>
  );
}

// The link that opens one section in full; absent once it is open or when everything is shown.
function ShowAll({
  section,
  shown,
  total,
  noun,
  outcome,
  params,
}: {
  section: SearchSection;
  shown: number;
  total: number;
  noun: string;
  outcome: SearchOutcome;
  params: SearchParams;
}) {
  if (outcome.show || total <= shown) return null;
  return (
    <Link
      href={searchHref({ q: params.q, type: params.type, show: section })}
      className={`inline-flex min-h-11 items-center text-sm font-semibold text-link underline-offset-4 hover:underline ${FOCUS}`}
    >
      Show all {total} {noun}
    </Link>
  );
}

function Pager({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  const href = (page: number) => searchHref({ q: params.q, type: params.type, show: outcome.show ?? undefined, page });
  return (
    <Pagination className="mt-6" aria-label="Result pages">
      <PaginationContent>
        {outcome.page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={href(outcome.page - 1)} className="min-h-11" />
          </PaginationItem>
        )}
        <PaginationItem className="px-2 text-sm">
          Page {outcome.page} of {outcome.pages}
        </PaginationItem>
        {outcome.page < outcome.pages && (
          <PaginationItem>
            <PaginationNext href={href(outcome.page + 1)} className="min-h-11" />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function CourseCard({ course, terms }: { course: CourseHit; terms: string[] }) {
  const details = [`Semester ${course.semester}`, course.chapterCount > 0 && plural(course.chapterCount, "chapter"), plural(course.fileCount, "file")].filter(Boolean);
  return (
    <li className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
      <Link href={`/courses/${encodeURIComponent(course.code)}`} className={`group/hit flex items-center gap-3.5 p-3.5 hover:bg-muted/60 focus-visible:bg-muted/60 ${FOCUS}`}>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-sm text-link">
          <Highlighted marked={markText(course.code, terms)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-heading">
            <Highlighted marked={markText(course.title, terms)} />
          </span>
          <span className="mt-0.5 block text-sm">{details.join(" · ")}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover/hit:text-link" />
      </Link>
    </li>
  );
}

function ChapterRow({ chapter, terms }: { chapter: ChapterHit; terms: string[] }) {
  return (
    <li>
      <Link href={`/courses/${encodeURIComponent(chapter.courseCode)}/chapters/${chapter.position}`} className={ROW_LINK}>
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-heading">
          {chapter.position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-heading">
            <span className="sr-only">Chapter {chapter.position}: </span>
            <Highlighted marked={markText(chapter.title, terms)} />
          </span>
          <span className="mt-0.5 block text-sm">
            {chapter.courseCode} · {chapter.courseTitle} · {plural(chapter.fileCount, "file")}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover/hit:text-link" />
      </Link>
    </li>
  );
}

function FileRow({ hit, terms }: { hit: FileHit; terms: string[] }) {
  const { resource } = hit;
  const title = markText(resource.title, terms);
  // A file that matched in its description for words its title lacks shows the part that did.
  const missing = terms.filter((term) => markText(resource.title, [term]).ranges.length === 0);
  const snippet = missing.length > 0 && resource.description ? snippetAround(resource.description, missing) : null;
  const chapter =
    hit.chapterPosition !== null ? `Chapter ${hit.chapterPosition}` : hit.courseHasChapters && resource.type !== "exam" ? "General" : null;
  const meta = [chapter, RESOURCE_TYPE_SINGULAR_LABELS[resource.type]].filter(Boolean).join(" · ");
  return (
    <ResourceRow
      resource={resource}
      showCourse
      title={<Highlighted marked={title} />}
      meta={meta}
      snippet={snippet && <Highlighted marked={snippet} />}
    />
  );
}

// ----- nothing found

function NoResults({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-6">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-heading">No results for “{outcome.query}”</h2>
      {outcome.chip !== "all" && (
        <Link
          href={searchHref({ q: params.q, type: "all" })}
          className={`mt-2 inline-flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline ${FOCUS}`}
        >
          Search all types instead of only {CHIP_LABELS[outcome.chip]}
        </Link>
      )}
      <div className="mt-3 space-y-1.5 text-sm">
        <p className="font-semibold text-heading">Search tips</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Try a course code, like DEMO301</li>
          <li>Use fewer words, or check the spelling</li>
          <li>Accents and capitals don&apos;t matter</li>
        </ul>
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/">Browse courses</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/exams">Previous exams</Link>
        </Button>
      </div>
    </div>
  );
}
