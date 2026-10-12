import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ResourceListItem } from "@/services/resources/types";

// Opening goes through the API route, which redirects to the material. It is a plain <a>, not
// next/link: the target is not a page, and Link would prefetch it when it scrolls into view.
function openHref(id: string): string {
  return `/api/v1/resources/${id}/open`;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// One resource in a list: opens in a new tab, with its solutions (if any) as links below.
// `showCourse` adds the course code, for lists that mix courses.
export function ResourceRow({ resource, showCourse = false }: { resource: ResourceListItem; showCourse?: boolean }) {
  return (
    <li className="rounded-lg border bg-card">
      <a
        href={openHref(resource.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-lg p-3 hover:bg-muted/50 ${FOCUS}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-heading">
            {showCourse && <span className="mr-2 font-mono text-xs font-medium text-link">{resource.courseCode}</span>}
            {resource.title}
          </span>
          <ExternalLink aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline">{LANGUAGE_LABELS[resource.language]}</Badge>
          {resource.academicYearStart !== null && (
            <Badge variant="secondary">{formatAcademicYear(resource.academicYearStart)}</Badge>
          )}
          {resource.examSession && <Badge variant="secondary">{EXAM_SESSION_LABELS[resource.examSession]}</Badge>}
        </span>
      </a>
      {resource.solutions.length > 0 && (
        // A sibling of the row link: links must not be nested.
        <div className="flex flex-wrap gap-2 border-t px-3 py-1">
          {resource.solutions.map((solution, index) => (
            <a
              key={solution.id}
              href={openHref(solution.id)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-link hover:underline ${FOCUS}`}
            >
              {resource.solutions.length > 1 ? `Solution ${index + 1}` : "Solution"}
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
