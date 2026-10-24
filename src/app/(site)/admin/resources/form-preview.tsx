import { TYPE_ICONS } from "@/components/site/resource-row";
import { Badge } from "@/components/ui/badge";
import type { ExamSession, Language, ResourceType } from "@/db/constants";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, formatAcademicYear } from "@/lib/labels";
import { previewWhere } from "./form-helpers";

// What a student will see for the resource as it is typed now. Plain text, not a link, and not a
// list item: it is a picture of a row, not a row.
export function FormPreview({
  type,
  title,
  language,
  academicYearStart,
  examSession,
  courseCode,
  chapterPosition,
}: {
  type: ResourceType;
  title: string;
  language: Language;
  academicYearStart: number | null;
  examSession: ExamSession | null;
  courseCode: string;
  chapterPosition: number | null;
}) {
  const TypeIcon = TYPE_ICONS[type];
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold text-heading">How students will see it</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted-foreground">Updates as you type.</p>
      <div data-testid="preview" className="flex items-start gap-3 rounded-lg border p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-link">
          <TypeIcon aria-hidden className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-heading [overflow-wrap:anywhere]">{title.trim() || "Untitled"}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="outline">{LANGUAGE_LABELS[language]}</Badge>
            {academicYearStart !== null && <Badge variant="outline">{formatAcademicYear(academicYearStart)}</Badge>}
            {type === "exam" && examSession && <Badge variant="outline">{EXAM_SESSION_LABELS[examSession]}</Badge>}
          </span>
        </span>
      </div>
      <p data-testid="preview-where" className="mt-2.5 text-[0.8125rem] text-muted-foreground">
        {previewWhere(courseCode, type, chapterPosition)}
      </p>
    </section>
  );
}
