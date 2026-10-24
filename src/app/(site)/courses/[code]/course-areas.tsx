import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { StateBlock } from "@/components/site/state-block";
import { groupExamsByYear } from "@/lib/group-exams";
import { EXAM_SESSION_LABELS, RESOURCE_TYPE_LABELS, describeGroups, formatAcademicYear } from "@/lib/labels";
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

export function AreaSwitch({ area, hasOther }: { area: CourseArea; hasOther: boolean }) {
  const items: { area: CourseArea; label: string; href: string }[] = [
    { area: "chapters", label: "Chapters", href: "?" },
    { area: "exams", label: "Previous exams", href: "?tab=exams" },
    ...(hasOther ? [{ area: "other" as const, label: "Other material", href: "?tab=other" }] : []),
  ];
  return (
    <nav aria-label="Course areas" className="mb-5 inline-flex max-w-full rounded-lg border bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.area}
          href={item.href}
          aria-current={item.area === area ? "page" : undefined}
          className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors sm:px-4 md:min-h-9 ${FOCUS} ${
            item.area === area
              ? "border border-primary/40 bg-card text-heading shadow-sm"
              : "border border-transparent text-muted-foreground hover:text-heading"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function ChapterCards({ code, chapters }: { code: string; chapters: CourseOutline["chapters"] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {chapters.map((chapter) => {
        const hasItems = chapter.itemCount > 0;
        const body = (
          <>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">Chapter {chapter.position}</span>
              <span className="mt-0.5 block text-base font-medium text-heading">{chapter.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {hasItems ? describeGroups(chapter.groups) : "Nothing yet"}
              </span>
            </span>
            {hasItems && (
              <ChevronRight
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-link"
              />
            )}
          </>
        );
        return (
          <li key={chapter.id}>
            {hasItems ? (
              <Link
                href={`/courses/${encodeURIComponent(code)}/chapters/${chapter.position}`}
                className="group flex h-full min-h-20 items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {body}
              </Link>
            ) : (
              <div className="flex h-full min-h-20 items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/40 p-4">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ExamsArea({ code, exams }: { code: string; exams: CourseOutline["exams"] }) {
  if (exams.length === 0) {
    return <StateBlock icon={FileText}>No previous exams yet.</StateBlock>;
  }
  return (
    <div>
      <div className="space-y-4">
        {groupExamsByYear(exams).map((group) => (
          <div key={group.year ?? "none"}>
            <h2 className="mb-2 text-sm font-medium text-heading">
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
        className={`mt-3 inline-flex min-h-11 items-center rounded-md text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
      >
        All exams for this course
      </Link>
    </div>
  );
}

export function OtherArea({ groups }: { groups: ResourceGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.type}>
          <h2 className="mb-2 text-sm font-medium text-heading">{RESOURCE_TYPE_LABELS[group.type]}</h2>
          <ul className="space-y-2">
            {group.resources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
