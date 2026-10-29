"use client";

import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TITLE_MAX_LENGTH, RESOURCE_TYPES } from "@/db/constants";
import type { ExamSession, Language, ResourceType } from "@/db/constants";
import { EXAM_SESSION_LABELS, LANGUAGE_NAMES, RESOURCE_TYPE_SINGULAR_LABELS } from "@/lib/labels";
import { describeTextCheck, textLayerStatus, type TextCheck } from "@/lib/pdf-text-check";
import { formatFileSize } from "@/lib/upload-file";
import type { ChapterOption } from "@/services/chapters/options";
import type { YearOption } from "../form-helpers";

export type RowStatus = "queued" | "uploading" | "ready" | "saving" | "failed";

export interface BulkRow {
  key: string;
  fileName: string;
  size: number;
  title: string;
  type: ResourceType;
  chapterId: string;
  yearStart: string;
  examSession: ExamSession | "";
  language: Language;
  status: RowStatus;
  progress: number;
  ticket: string | null;
  // The browser's text check of the uploaded file; null when it could not be made.
  textCheck: TextCheck | null;
  // Why the file is unusable (status "failed"), and whether picking it again from memory can help.
  fileError: string | null;
  retryable: boolean;
  // What the server said about the fields, and anything else that went wrong when saving.
  errors: Record<string, string>;
  error: string | null;
}

// The client-side rules a row must meet before it may be saved. The server checks the same and more.
export function rowProblems(row: BulkRow): Record<string, string> {
  const problems: Record<string, string> = {};
  if (row.title.trim() === "") problems.title = "Enter a title.";
  if (row.type === "exam" && row.examSession === "") problems.examSession = "Choose a session.";
  return problems;
}

export const BULK_COLUMNS = "md:grid-cols-[minmax(0,2.4fr)_8rem_minmax(0,1.6fr)_8.5rem_9rem_7rem_5.5rem]";

const SELECT = "w-full [&_select]:h-11 md:[&_select]:h-9";

function Cell({ label, children, hiddenOnPhone }: { label: string; children: ReactNode; hiddenOnPhone?: boolean }) {
  return (
    <div className={hiddenOnPhone ? "hidden min-w-0 md:block" : "min-w-0"}>
      <span aria-hidden className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

export function BulkRowView({
  row,
  chapters,
  years,
  disabled,
  onEdit,
  onRemove,
  onRetry,
}: {
  row: BulkRow;
  chapters: ChapterOption[];
  years: YearOption[];
  disabled: boolean;
  onEdit: (patch: Partial<BulkRow>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const problems = { ...rowProblems(row), ...row.errors };
  const locked = disabled || row.status === "saving";
  const f = row.fileName;
  const titleErrorId = `${row.key}-title-error`;
  const isExam = row.type === "exam";

  return (
    <li className={`grid min-w-0 gap-3 rounded-lg border bg-card p-3 md:items-start ${BULK_COLUMNS}`}>
      <Cell label="Title">
        <Input
          aria-label={`Title for ${f}`}
          value={row.title}
          maxLength={RESOURCE_TITLE_MAX_LENGTH}
          disabled={locked || row.status === "failed"}
          onChange={(e) => onEdit({ title: e.target.value })}
          aria-invalid={problems.title ? true : undefined}
          aria-describedby={problems.title ? titleErrorId : undefined}
          className="h-11 md:h-9"
        />
        {problems.title && (
          <p id={titleErrorId} role="alert" className="mt-1 text-sm font-medium text-destructive">
            {problems.title}
          </p>
        )}
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{f}</span>
          <span className="shrink-0">{formatFileSize(row.size)}</span>
        </p>
        <RowStatusLine row={row} onRetry={onRetry} />
      </Cell>

      <Cell label="Type">
        <NativeSelect
          aria-label={`Type for ${f}`}
          value={row.type}
          disabled={locked}
          onChange={(e) => onEdit({ type: e.target.value as ResourceType })}
          className={SELECT}
        >
          {RESOURCE_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {RESOURCE_TYPE_SINGULAR_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Cell>

      <Cell label="Chapter" hiddenOnPhone={isExam}>
        {isExam ? (
          <span aria-hidden className="flex h-9 items-center text-sm text-muted-foreground">
            -
          </span>
        ) : (
          <NativeSelect
            aria-label={`Chapter for ${f}`}
            value={row.chapterId}
            disabled={locked || chapters.length === 0}
            onChange={(e) => onEdit({ chapterId: e.target.value })}
            aria-invalid={problems.chapterId ? true : undefined}
            className={SELECT}
          >
            <NativeSelectOption value="">{chapters.length === 0 ? "No chapters" : "No chapter"}</NativeSelectOption>
            {chapters.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.position}. {c.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {problems.chapterId && (
          <p role="alert" className="mt-1 text-sm font-medium text-destructive">
            Choose a chapter of this course.
          </p>
        )}
      </Cell>

      <Cell label="Academic year">
        <NativeSelect
          aria-label={`Academic year for ${f}`}
          value={row.yearStart}
          disabled={locked}
          onChange={(e) => onEdit({ yearStart: e.target.value })}
          aria-invalid={problems.academicYearStart ? true : undefined}
          className={SELECT}
        >
          <NativeSelectOption value="">Not set</NativeSelectOption>
          {years.map((y) => (
            <NativeSelectOption key={y.value} value={y.value}>
              {y.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Cell>

      <Cell label="Session" hiddenOnPhone={!isExam}>
        {isExam ? (
          <NativeSelect
            aria-label={`Session for ${f}`}
            value={row.examSession}
            disabled={locked}
            onChange={(e) => onEdit({ examSession: e.target.value as ExamSession | "" })}
            aria-invalid={problems.examSession ? true : undefined}
            className={SELECT}
          >
            <NativeSelectOption value="">Choose</NativeSelectOption>
            {EXAM_SESSIONS.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {EXAM_SESSION_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <span aria-hidden className="flex h-9 items-center text-sm text-muted-foreground">
            -
          </span>
        )}
        {isExam && problems.examSession && (
          <p role="alert" className="mt-1 text-sm font-medium text-destructive">
            {problems.examSession}
          </p>
        )}
      </Cell>

      <Cell label="Language">
        <NativeSelect
          aria-label={`Language for ${f}`}
          value={row.language}
          disabled={locked}
          onChange={(e) => onEdit({ language: e.target.value as Language })}
          className={SELECT}
        >
          {LANGUAGES.map((l) => (
            <NativeSelectOption key={l} value={l}>
              {LANGUAGE_NAMES[l]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Cell>

      <div className="min-w-0 md:text-right">
        <Button type="button" variant="outline" disabled={row.status === "saving"} onClick={onRemove} aria-label={`Remove ${f}`} className="h-11 w-full md:h-9 md:w-auto">
          Remove
        </Button>
      </div>
    </li>
  );
}

function RowStatusLine({ row, onRetry }: { row: BulkRow; onRetry: () => void }) {
  if (row.status === "queued") return <p className="mt-1 text-xs text-muted-foreground">Waiting to upload.</p>;
  if (row.status === "uploading") {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <Progress value={row.progress} aria-label={`Upload progress for ${row.fileName}`} className="h-2" />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.progress}%</span>
      </div>
    );
  }
  if (row.status === "saving") return <p className="mt-1 text-xs text-muted-foreground">Saving...</p>;
  if (row.status === "failed") {
    return (
      <div className="mt-1 space-y-1.5">
        <p role="alert" className="text-sm font-medium text-destructive">
          {row.fileError}
        </p>
        {row.retryable && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} aria-label={`Retry upload of ${row.fileName}`} className="h-11 md:h-8">
            Try again
          </Button>
        )}
      </div>
    );
  }
  return (
    <>
      <p className="mt-1 text-xs text-foreground">Uploaded.</p>
      {row.textCheck && textLayerStatus(row.textCheck.pageCount, row.textCheck.textPageCount) !== "text" && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="text-check-note">
          {describeTextCheck(row.textCheck.pageCount, row.textCheck.textPageCount)}
        </p>
      )}
      {row.error && (
        <p role="alert" className="mt-1 text-sm font-medium text-destructive">
          {row.error}
        </p>
      )}
    </>
  );
}
