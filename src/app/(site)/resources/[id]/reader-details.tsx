import { CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { EXAM_SESSION_LABELS, LANGUAGE_NAMES, RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { isMarkable } from "@/services/progress/markable";
import { AddToTodoButton } from "./add-to-todo-button";
import { MarkDoneButton } from "./mark-done-button";
import { SaveButton } from "./save-button";
import type { ReaderResource } from "@/services/resources/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LINK = `inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`;
const HEADING = "text-xs font-semibold tracking-wider text-muted-foreground uppercase";

// Below the file on phones, beside it from md up. Plain text under small headings, not cards, so
// the file keeps the weight. Only what exists is shown.
export function ReaderDetails({ resource }: { resource: ReaderResource }) {
  const lines = [
    resource.academicYearStart !== null || resource.examSession
      ? [
          ...(resource.academicYearStart !== null ? [formatAcademicYear(resource.academicYearStart)] : []),
          ...(resource.examSession ? [EXAM_SESSION_LABELS[resource.examSession]] : []),
        ].join(" · ")
      : null,
    LANGUAGE_NAMES[resource.language],
  ].filter((line): line is string => line !== null);
  const related = [
    ...(resource.solutionOf ? [{ ref: resource.solutionOf, label: `Solution of: ${resource.solutionOf.title}` }] : []),
    ...resource.solutions.map((ref, i) => ({
      ref,
      label: resource.solutions.length > 1 ? `Solution ${i + 1}: ${ref.title}` : `Solution: ${ref.title}`,
    })),
  ];

  return (
    <aside aria-label="About this file" className="space-y-5 text-sm md:pt-1">
      <div className="space-y-2">
        <SaveButton resourceId={resource.id} />
        <AddToTodoButton resourceId={resource.id} />
        {isMarkable(resource.type) && <MarkDoneButton resourceId={resource.id} isExam={resource.type === "exam"} />}
      </div>

      <section className="space-y-1.5">
        <h2 className={HEADING}>Details</h2>
        {resource.description && <p>{resource.description}</p>}
        <p className="text-heading">
          <span className="font-mono text-link">{resource.courseCode}</span> · {resource.courseTitle}
        </p>
        <p>
          {RESOURCE_TYPE_SINGULAR_LABELS[resource.type]}
          {resource.chapterPosition !== null && ` · Chapter ${resource.chapterPosition}`}
        </p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>

      {related.length > 0 && (
        <section>
          <h2 className={HEADING}>{!resource.solutionOf ? "Solutions" : resource.solutions.length === 0 ? "Solution of" : "Related"}</h2>
          <ul>
            {related.map(({ ref, label }) => (
              <li key={ref.id}>
                <Link href={`/resources/${ref.id}`} className={LINK}>
                  <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
                  <span className="min-w-0">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resource.backupUrl && (
        <section>
          <h2 className={HEADING}>Backup link</h2>
          <a href={resource.backupUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            Open the backup link
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </section>
      )}
    </aside>
  );
}
