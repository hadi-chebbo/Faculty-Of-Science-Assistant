import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  NotebookText,
  PencilLine,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ResourceType } from "@/db/constants";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ResourceListItem } from "@/services/resources/types";

// A resource opens on its reader page, in the same tab. (The open API route, which redirects to
// the file itself, is only for "Open outside" in the reader and for the admin screens.)
function readerHref(id: string): string {
  return `/resources/${id}`;
}

export const TYPE_ICONS: Record<ResourceType, LucideIcon> = {
  lecture: Presentation,
  notes: NotebookText,
  exercise: PencilLine,
  exam: ClipboardCheck,
  solution: CheckCircle2,
  other: FileText,
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// One resource in a list: opens its reader page, with its solutions (if any) as links below.
// `showCourse` adds the course code, for lists that mix courses. `lead` becomes the main text and
// the title moves to a smaller muted line; the year and session badges are then left out, because
// the surrounding list already says them. The search results add three things: `title` replaces the
// title's text (with its matches marked), `meta` is a small line under it (chapter and type) and
// `snippet` is a short line of the description, for a file that matched only there.
export function ResourceRow({
  resource,
  showCourse = false,
  lead,
  title,
  meta,
  snippet,
}: {
  resource: ResourceListItem;
  showCourse?: boolean;
  lead?: string;
  title?: React.ReactNode;
  meta?: string;
  snippet?: React.ReactNode;
}) {
  const TypeIcon = TYPE_ICONS[resource.type];
  return (
    <li className="group/row overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40">
      <Link
        href={readerHref(resource.id)}
        className={`flex items-start gap-3 p-3 hover:bg-muted/60 focus-visible:bg-muted/60 ${FOCUS}`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-link">
          <TypeIcon aria-hidden className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-heading">
            {showCourse && <span className="mr-2 font-mono text-xs font-medium text-link">{resource.courseCode}</span>}
            {lead ?? title ?? resource.title}
          </span>
          {lead !== undefined && <span className="mt-0.5 block text-xs text-muted-foreground">{resource.title}</span>}
          {meta && <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>}
          {snippet && <span className="mt-0.5 block text-xs text-muted-foreground">{snippet}</span>}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="outline">{LANGUAGE_LABELS[resource.language]}</Badge>
            {lead === undefined && resource.academicYearStart !== null && (
              <Badge variant="secondary">{formatAcademicYear(resource.academicYearStart)}</Badge>
            )}
            {lead === undefined && resource.examSession && <Badge variant="secondary">{EXAM_SESSION_LABELS[resource.examSession]}</Badge>}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-link"
        />
      </Link>
      {resource.solutions.length > 0 && (
        // A sibling of the row link: links must not be nested.
        <div className="flex flex-wrap gap-x-3 border-t bg-muted/30 py-0.5 pl-[3.75rem] pr-3">
          {resource.solutions.map((solution, index) => (
            <Link
              key={solution.id}
              href={readerHref(solution.id)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
            >
              <CheckCircle2 aria-hidden className="size-3.5" />
              {resource.solutions.length > 1 ? `Solution ${index + 1}` : "Solution"}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
