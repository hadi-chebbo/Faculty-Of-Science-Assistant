import { FileText } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { StateBlock } from "@/components/site/state-block";
import { TYPE_STYLES, YEAR_STYLES } from "@/lib/design-language";
import { groupExamsByYear } from "@/lib/group-exams";
import { EXAM_SESSION_LABELS, RESOURCE_TYPE_LABELS, formatAcademicYear, groupCounts } from "@/lib/labels";
import type { Year } from "@/lib/years";
import { pageHref } from "./taught-by";
import { ChapterProgressBar, ChapterProgressText } from "./course-progress";
import type { CourseOutline, ResourceGroup } from "@/services/courses/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type CourseArea = "chapters" | "exams" | "other";

// Anything but a known ?tab= value is the Chapters area; "other" needs material to show.
export function parseArea(raw: string | string[] | undefined, hasOther: boolean): CourseArea {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "exams") return "exams";
  if (value === "other" && hasOther) return "other";
  return "chapters";
}

// What each area holds, as shown (so narrowed by a chosen lecturer): chapters, exam rows, files with no chapter.
export function areaCounts(outline: CourseOutline): Record<CourseArea, number> {
  return {
    chapters: outline.chapters.length,
    exams: outline.exams.length,
    other: outline.general.reduce((sum, group) => sum + group.resources.length, 0),
  };
}

// The area links keep the chosen lecturer. The current area takes the course's year colour. On a phone each link is its
// own 44px pill in a row that scrolls sideways if it must; from md up they sit together in one segmented control.
export function AreaSwitch({
  area,
  hasOther,
  path,
  lecturer,
  year,
  counts,
}: {
  area: CourseArea;
  hasOther: boolean;
  path: string;
  lecturer: string | null;
  year: Year;
  counts: Record<CourseArea, number>;
}) {
  const href = (tab: string | null) => pageHref(path, { tab, lecturer });
  const items: { area: CourseArea; label: React.ReactNode; href: string }[] = [
    { area: "chapters", label: "Chapters", href: href(null) },
    { area: "exams", label: "Previous exams", href: href("exams") },
    // "Other" on a small phone so the three tabs fit; the name read out stays "Other material".
    ...(hasOther
      ? [{ area: "other" as const, label: <>Other<span className="max-sm:sr-only"> material</span></>, href: href("other") }]
      : []),
  ];
  return (
    <nav
      aria-label="Course areas"
      className="scroll-fade -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pe-6 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:inline-flex md:max-w-full md:gap-1 md:rounded-2xl md:border md:bg-card md:p-1 md:[mask-image:none]"
    >
      {items.map((item) => {
        const current = item.area === area;
        return (
          <Link
            key={item.area}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-medium transition-colors md:min-h-9 md:border-0 ${FOCUS} ${
              current ? `border-transparent ${YEAR_STYLES[year].solid}` : "bg-card text-foreground hover:bg-muted hover:text-heading"
            }`}
          >
            {item.label}
            <span className={`text-xs ${current ? "" : "text-muted-foreground"}`}>{counts[item.area]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Chapter cards: "Chapter N" with the student's progress at the right, the title, one type-coloured chip per kind of
// file, and (signed in) a progress edge along the bottom. A chapter with nothing in it is a muted dashed card, not a link.
export function ChapterCards({
  year,
  code,
  chapters,
  lecturer,
}: {
  year: Year;
  code: string;
  chapters: CourseOutline["chapters"];
  lecturer: { slug: string; name: string } | null;
}) {
  if (chapters.length === 0 && lecturer) {
    return <StateBlock icon={FileText}>No chapter has files by {lecturer.name}.</StateBlock>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {chapters.map((chapter, index) => {
        const hasItems = chapter.itemCount > 0;
        return (
          <li key={chapter.id} style={{ "--rise-delay": `${Math.min(index, 8) * 50}ms` } as React.CSSProperties} className="rise-in">
            {hasItems ? (
              // The lift is on a wrapper: the list item's rise-in animation holds its own transform.
              <div className="h-full transition-transform motion-safe:hover:-translate-y-0.5">
                <Link
                  href={pageHref(`/courses/${encodeURIComponent(code)}/chapters/${chapter.position}`, { lecturer: lecturer?.slug })}
                  className={`relative flex h-full min-h-36 flex-col gap-2 overflow-hidden rounded-3xl border bg-card p-5 transition-[border-color,box-shadow] hover:shadow-md has-[[data-finished=true]]:border-success/45 ${YEAR_STYLES[year].border} ${FOCUS}`}
                >
                  <span className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold tracking-wide text-muted-foreground uppercase">Chapter {chapter.position}</span>
                    <ChapterProgressText code={code} position={chapter.position} />
                  </span>
                  <span className="text-base font-semibold leading-snug text-heading">{chapter.title}</span>
                  <TypeChips groups={chapter.groups} />
                  <ChapterProgressBar code={code} position={chapter.position} />
                </Link>
              </div>
            ) : (
              <div className="flex h-full min-h-36 flex-col gap-2 rounded-3xl border border-dashed bg-muted/40 p-5 text-muted-foreground">
                <span className="text-xs font-semibold tracking-wide uppercase">Chapter {chapter.position}</span>
                <span className="text-base font-semibold leading-snug">{chapter.title}</span>
                <span className="mt-auto pt-2 text-sm">No files yet</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// "2 lectures", "1 exercise", ...: one chip per kind of file, in the type's colour. The words name the type, so colour is
// never the only signal.
function TypeChips({ groups }: { groups: ResourceGroup[] }) {
  return (
    <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
      {groupCounts(groups).map((entry) => (
        <span key={entry.type} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[entry.type].chip}`}>
          {entry.label}
        </span>
      ))}
    </span>
  );
}

export function ExamsArea({
  code,
  exams,
  lecturer,
}: {
  code: string;
  exams: CourseOutline["exams"];
  lecturer: { name: string } | null;
}) {
  if (exams.length === 0) {
    return <StateBlock icon={FileText}>{lecturer ? `No previous exams by ${lecturer.name}.` : "No previous exams yet."}</StateBlock>;
  }
  return (
    <div>
      <div className="space-y-6">
        {groupExamsByYear(exams).map((group) => (
          <div key={group.year ?? "none"}>
            <h2 className="mb-2.5 text-base font-semibold text-heading">
              {group.year === null ? "Year not set" : formatAcademicYear(group.year)}
            </h2>
            <ul className="space-y-2">
              {group.exams.map((exam) => (
                <ResourceRow
                  key={exam.id}
                  resource={exam}
                  lead={exam.examSession ? EXAM_SESSION_LABELS[exam.examSession] : "Exam"}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link
        href={`/exams?course=${encodeURIComponent(code)}`}
        className={`mt-4 inline-flex min-h-11 items-center rounded-md text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
      >
        All exams for this course
      </Link>
    </div>
  );
}

export function OtherArea({ groups, lecturer }: { groups: ResourceGroup[]; lecturer: { name: string } | null }) {
  if (groups.length === 0) {
    return <StateBlock icon={FileText}>{lecturer ? `No other material by ${lecturer.name}.` : "No other material yet."}</StateBlock>;
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <TypeSection key={group.type} group={group} />
      ))}
    </div>
  );
}

// A list of one type of file under its heading and count ("Lectures 2"). `id` lets a page link to the section.
export function TypeSection({ group, id }: { group: ResourceGroup; id?: string }) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20">
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 id={headingId} className="text-base font-semibold text-heading">
          {RESOURCE_TYPE_LABELS[group.type]}
        </h2>
        <span className="text-sm text-muted-foreground">{group.resources.length}</span>
      </div>
      <ul className="space-y-2">
        {group.resources.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} />
        ))}
      </ul>
    </section>
  );
}
