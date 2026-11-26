import { SearchX } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { Highlighted } from "@/components/site/highlighted";
import { YearCircle } from "@/components/site/year-badge";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import type { ExamSession, ResourceType } from "@/db/constants";
import { descriptionSnippet, markText } from "@/lib/highlight";
import { RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { YEAR_STYLES } from "@/lib/design-language";
import { YEARS, courseYearSemesterLabel, yearHref, yearLabel, yearOfSemester } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { cn } from "@/lib/utils";
import { SEARCH_CHIPS, type SearchChip } from "@/services/search/query";
import type { SearchSection } from "@/services/search/schemas";
import { searchCatalog } from "@/services/search/search";
import type { ChapterHit, CourseHit, FileHit, SearchFilters, SearchOutcome } from "@/services/search/types";
import { ChipRow } from "./chips";
import { searchHref, type SearchParams } from "./params";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const CHIP_LABELS: Record<SearchChip, string> = {
  all: "All",
  course: "Courses",
  lecture: "Lectures & notes",
  exercise: "Exercises",
  exam: "Exams",
};

// What shows before there is a query to search for (fewer than two characters).
export function SearchHints() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed">
        Try a course code, a topic (<b className="font-semibold text-heading">graphs</b>), or an exam (
        <b className="font-semibold text-heading">final 2024</b>). Accents don&apos;t matter.
      </p>
      <div>
        <h2 className="mb-2 text-base font-semibold text-heading">Or browse a year</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {YEARS.map((year) => (
            <li key={year}>
              <Link
                href={yearHref(year)}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 font-semibold text-heading transition-colors hover:bg-muted/60 ${YEAR_STYLES[year].border} ${FOCUS}`}
              >
                <YearCircle year={year} className="size-8 text-sm" />
                {yearLabel(year)}
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
  const short = outcome.state === "short";
  const empty = [outcome.courses, outcome.chapters, outcome.files].every((g) => g === null || g.total === 0);
  return (
    <div className="space-y-5">
      {/* The one live region of the page. It is always here, so a screen reader hears the summary
          of each new result (including "No results") and nothing else on the page is live. */}
      <p className="sr-only" aria-live="polite" role="status">
        {short ? "" : summaryText(outcome)}
      </p>
      {short ? (
        <SearchHints />
      ) : (
        <>
          <Chips outcome={outcome} params={params} />
          {empty ? <NoResults outcome={outcome} params={params} /> : <Found outcome={outcome} params={params} />}
        </>
      )}
    </div>
  );
}

// ----- chips

function Chips({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  // "All" is written into the address only when the words of the query would otherwise select a chip.
  const chips = SEARCH_CHIPS.map((chip) => ({
    key: chip,
    label: CHIP_LABELS[chip],
    href: searchHref({ q: params.q, type: chip === "all" ? (outcome.impliedChip !== "all" ? "all" : undefined) : chip }),
    active: outcome.chip === chip,
  }));
  return <ChipRow chips={chips} />;
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
const SESSION_PHRASES: Record<ExamSession, string> = { partial: "partial", final: "final", second: "second session" };

const joinWords = (words: string[]) => (words.length < 3 ? words.join(" or ") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`);

function filterParts(filters: SearchFilters) {
  const sessions = filters.sessions.map((s) => SESSION_PHRASES[s]);
  return {
    session: sessions.length > 0 ? joinWords(sessions) : null,
    noun: filters.types.length > 0 ? joinWords(filters.types.map((t) => TYPE_NOUNS[t])) : "files",
    year: filters.year === null ? null : formatAcademicYear(filters.year),
  };
}

const resultCount = (total: number) => `${total} ${total === 1 ? "result" : "results"}`;
const hasFilters = (filters: SearchFilters) => filters.types.length > 0 || filters.sessions.length > 0 || filters.year !== null;

// What the live region says: the line below as plain text, or "No results for …", or the count.
function summaryText(outcome: SearchOutcome): string {
  const total = (outcome.courses?.total ?? 0) + (outcome.chapters?.total ?? 0) + (outcome.files?.total ?? 0);
  if (total === 0) return `No results for “${outcome.query}”`;
  if (hasFilters(outcome.filters)) {
    const { session, noun, year } = filterParts(outcome.filters);
    const files = outcome.files?.total ?? 0;
    return `Showing ${[session, noun].filter(Boolean).join(" ")}${year ? ` from ${year}` : ""} · ${resultCount(files)}`;
  }
  return resultCount(total);
}

// "Showing final exams from 2024-2025 · 3 results": the filters found in the words of the query.
// The live region says the same, so this copy is hidden from screen readers.
function FilterLine({ filters, total }: { filters: SearchFilters; total: number }) {
  const { session, noun, year } = filterParts(filters);
  return (
    <p className="text-sm" aria-hidden>
      Showing{" "}
      {session && (
        <>
          <b className="font-semibold text-heading">{session}</b>{" "}
        </>
      )}
      {session === null && year === null ? <b className="font-semibold text-heading">{noun}</b> : noun}
      {year && (
        <>
          {" "}
          from <b className="font-semibold text-heading">{year}</b>
        </>
      )}{" "}
      · {resultCount(total)}
    </p>
  );
}

// ----- results

function Found({ outcome, params }: { outcome: SearchOutcome; params: SearchParams }) {
  return (
    <>
      {hasFilters(outcome.filters) && <FilterLine filters={outcome.filters} total={outcome.files?.total ?? 0} />}
      {outcome.show && (
        <Link href={searchHref({ q: params.q, type: params.type })} className={`inline-flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:underline ${FOCUS}`}>
          &larr; All results
        </Link>
      )}
      {outcome.courses && outcome.courses.total > 0 && (
        <Section title="Courses" total={outcome.courses.total}>
          <ul className="grid gap-3 md:grid-cols-2">
            {outcome.courses.items.map((course) => (
              <CourseCard key={course.code} course={course} terms={outcome.highlight} />
            ))}
          </ul>
          <ShowAll section="courses" shown={outcome.courses.items.length} total={outcome.courses.total} noun="courses" outcome={outcome} params={params} />
        </Section>
      )}
      {outcome.chapters && outcome.chapters.total > 0 && (
        <Section title="Chapters" total={outcome.chapters.total}>
          <ul className="grid gap-3 md:grid-cols-2">
            {outcome.chapters.items.map((chapter) => (
              <ChapterRow key={`${chapter.courseCode}/${chapter.position}`} chapter={chapter} terms={outcome.highlight} />
            ))}
          </ul>
          <ShowAll section="chapters" shown={outcome.chapters.items.length} total={outcome.chapters.total} noun="chapters" outcome={outcome} params={params} />
        </Section>
      )}
      {outcome.files && outcome.files.total > 0 && (
        <Section title="Files" total={outcome.files.total}>
          <ul className="space-y-2.5">
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
    <section className="space-y-2.5">
      <h2 className="text-lg font-semibold tracking-tight text-heading">
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
      className={`inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold text-link hover:bg-muted/60 ${FOCUS}`}
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
            <PaginationPrevious href={href(outcome.page - 1)} className="min-h-11 rounded-xl" />
          </PaginationItem>
        )}
        <PaginationItem className="px-2 text-sm">
          Page {outcome.page} of {outcome.pages}
        </PaginationItem>
        {outcome.page < outcome.pages && (
          <PaginationItem>
            <PaginationNext href={href(outcome.page + 1)} className="min-h-11 rounded-xl" />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function CourseCard({ course, terms }: { course: CourseHit; terms: string[] }) {
  const empty = course.fileCount === 0;
  const details = [
    courseYearSemesterLabel(course.semester),
    course.chapterCount > 0 && plural(course.chapterCount, "chapter"),
    empty ? "No files yet" : plural(course.fileCount, "file"),
  ].filter(Boolean);
  const body = (
    <>
      <span
        className={cn(
          "w-fit rounded-md px-2 py-1 font-mono text-sm font-medium",
          empty ? "bg-muted text-muted-foreground" : YEAR_STYLES[yearOfSemester(course.semester)].chip,
        )}
      >
        <Highlighted marked={markText(course.code, terms)} />
      </span>
      <span className={`block font-semibold ${empty ? "text-muted-foreground" : "text-heading"}`}>
        <Highlighted marked={markText(course.title, terms)} />
      </span>
      <span className="block text-sm">{details.join(" · ")}</span>
    </>
  );
  if (empty) {
    return (
      <li className="rounded-3xl border border-dashed bg-muted/40">
        <div className="flex h-full flex-col gap-1.5 p-4">{body}</div>
      </li>
    );
  }
  return (
    <li className={cn("rounded-3xl border bg-card transition-colors", YEAR_STYLES[yearOfSemester(course.semester)].border)}>
      <Link href={`/courses/${encodeURIComponent(course.code)}`} className={`flex h-full flex-col gap-1.5 rounded-3xl p-4 hover:bg-muted/60 focus-visible:bg-muted/60 ${FOCUS}`}>
        {body}
      </Link>
    </li>
  );
}

function ChapterRow({ chapter, terms }: { chapter: ChapterHit; terms: string[] }) {
  return (
    <li className="rounded-3xl border bg-card transition-colors hover:border-primary/40">
      <Link
        href={`/courses/${encodeURIComponent(chapter.courseCode)}/chapters/${chapter.position}`}
        className={`flex h-full flex-col gap-1.5 rounded-3xl p-4 hover:bg-muted/60 focus-visible:bg-muted/60 ${FOCUS}`}
      >
        <span className="w-fit rounded-md bg-muted px-2 py-1 text-sm font-medium text-link">Chapter {chapter.position}</span>
        <span className="block font-semibold text-heading">
          <Highlighted marked={markText(chapter.title, terms)} />
        </span>
        <span className="block text-sm">
          {chapter.courseCode} · {chapter.courseTitle} · {plural(chapter.fileCount, "file")}
        </span>
      </Link>
    </li>
  );
}

function FileRow({ hit, terms }: { hit: FileHit; terms: string[] }) {
  const { resource } = hit;
  const title = markText(resource.title, terms);
  const snippet = descriptionSnippet(resource.title, resource.description, terms);
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
    <div className="rounded-3xl border bg-card px-5 py-6 md:px-6">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
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
          <li>Try a course code, or a word from the course title</li>
          <li>Use fewer words, or check the spelling</li>
          <li>Accents and capitals don&apos;t matter</li>
        </ul>
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button asChild variant="outline" className="h-11 rounded-xl px-4">
          <Link href="/">Browse courses</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl px-4">
          <Link href="/exams">Previous exams</Link>
        </Button>
      </div>
    </div>
  );
}
