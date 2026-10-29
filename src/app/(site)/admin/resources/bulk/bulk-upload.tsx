"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { adminFetch } from "@/lib/admin-fetch";
import { checkFileTextLayer } from "@/lib/pdf-text-check-client";
import { MAX_SIZE_LABEL, SignedOutError, UPLOAD_FAILED_MESSAGE, UploadError, checkPdfFile, uploadPdf } from "@/lib/upload-file";
import type { ChapterOption } from "@/services/chapters/options";
import type { CourseOption } from "@/services/courses/types";
import { academicYearOptions } from "../form-helpers";
import { BULK_COLUMNS, BulkRowView, rowProblems, type BulkRow } from "./bulk-row";
import { guessFromFileName } from "./guess";

export const MAX_FILES = 50;
const UPLOAD_CONCURRENCY = 3;
const SAVE_CONCURRENCY = 3;

const FILE_REJECTED = "The server did not accept this file. Try again, or remove the row and add the file again.";

let nextKey = 0;

function newRow(file: File): BulkRow {
  const guess = guessFromFileName(file.name);
  const problem = checkPdfFile(file);
  return {
    key: `row-${++nextKey}`,
    fileName: file.name,
    size: file.size,
    title: guess.title,
    type: guess.type ?? "lecture",
    chapterId: "",
    yearStart: guess.academicYearStart === undefined ? "" : String(guess.academicYearStart),
    examSession: guess.examSession ?? "",
    language: "en",
    status: problem ? "failed" : "queued",
    progress: 0,
    ticket: null,
    textCheck: null,
    fileError: problem,
    retryable: false,
    errors: {},
    error: null,
  };
}

// Many PDFs into one course: each file uploads at once (3 at a time), its details are guessed from its
// name and stay editable, and one Save creates a resource per ready row through POST /api/v1/resources.
export function BulkUpload({
  courses,
  chapters,
  initialCourseId,
}: {
  courses: CourseOption[];
  chapters: ChapterOption[];
  initialCourseId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const started = useRef(new Set<string>());
  const [courseId, setCourseId] = useState(initialCourseId);
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number; code: string } | null>(null);
  const [currentYear] = useState(() => new Date().getFullYear());

  const course = courses.find((c) => c.id === courseId);
  const courseChapters = chapters.filter((c) => c.courseId === courseId);

  // Leaving the page stops the uploads still running.
  useEffect(() => {
    const running = controllers.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);

  // Unsaved rows are lost when the page closes.
  useEffect(() => {
    if (rows.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [rows.length]);

  const patchRow = (key: string, patch: Partial<BulkRow>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // An edit by the admin clears what the server said about the row.
  const editRow = (key: string, patch: Partial<BulkRow>) => patchRow(key, { ...patch, errors: {}, error: null });

  async function startUpload(key: string) {
    const file = files.current.get(key);
    if (!file) return;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    patchRow(key, { status: "uploading", progress: 0 });
    // Runs beside the upload and never fails (null: not checked); waited for once the bytes are sent.
    const check = checkFileTextLayer(file);
    try {
      const ticket = await uploadPdf(file, {
        signal: controller.signal,
        onProgress: (progress) => patchRow(key, { progress }),
        onSignedOut: () => router.replace("/sign-in"),
      });
      const textCheck = await check;
      if (controller.signal.aborted) return;
      patchRow(key, { status: "ready", ticket, textCheck, progress: 100 });
    } catch (caught) {
      if (controller.signal.aborted || caught instanceof SignedOutError) return;
      const message = caught instanceof UploadError ? caught.message : UPLOAD_FAILED_MESSAGE;
      patchRow(key, { status: "failed", fileError: message, retryable: true });
    } finally {
      if (controllers.current.get(key) === controller) controllers.current.delete(key);
    }
  }

  // Starts queued uploads whenever a slot is free.
  useEffect(() => {
    let free = UPLOAD_CONCURRENCY - rows.filter((r) => r.status === "uploading").length;
    for (const row of rows) {
      if (free <= 0) break;
      if (row.status !== "queued" || started.current.has(row.key)) continue;
      started.current.add(row.key);
      free--;
      void startUpload(row.key);
    }
    // startUpload only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;
    const room = Math.max(0, MAX_FILES - rows.length);
    const taken = picked.slice(0, room);
    setNotice(
      picked.length > taken.length
        ? `A batch holds at most ${MAX_FILES} files. ${picked.length - taken.length} not added; save this batch first.`
        : null,
    );
    const added = taken.map((file) => {
      const row = newRow(file);
      files.current.set(row.key, file);
      return row;
    });
    setSaved(null);
    setRows((current) => [...current, ...added]);
  }

  function removeRow(key: string) {
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
    files.current.delete(key);
    setRows((current) => current.filter((r) => r.key !== key));
  }

  function retryRow(key: string) {
    started.current.delete(key);
    patchRow(key, { status: "queued", fileError: null, retryable: false, ticket: null, textCheck: null, progress: 0 });
  }

  function changeCourse(id: string) {
    if (id === courseId) return;
    if (rows.some((r) => r.chapterId !== "")) setPendingCourseId(id);
    else applyCourse(id);
  }

  function applyCourse(id: string) {
    setCourseId(id);
    setPendingCourseId(null);
    setSaved(null);
    setRows((current) => current.map((r) => ({ ...r, chapterId: "", errors: {}, error: null })));
  }

  async function saveRow(row: BulkRow, code: string) {
    const body = {
      courseId,
      type: row.type,
      title: row.title,
      academicYearStart: row.yearStart,
      examSession: row.type === "exam" ? row.examSession : null,
      language: row.language,
      chapterId: row.type !== "exam" && row.chapterId ? row.chapterId : null,
      isPublished,
      fileTicket: row.ticket,
      ...(row.textCheck ? { textCheck: row.textCheck } : {}),
    };
    try {
      const response = await adminFetch(
        "/api/v1/resources",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        files.current.delete(row.key);
        setRows((current) => current.filter((r) => r.key !== row.key));
        setSaved((s) => ({ code, count: (s?.code === code ? s.count : 0) + 1 }));
        return;
      }
      if (response.status === 400) {
        const data: { fields?: unknown } = await response.json().catch(() => ({}));
        const fields = Array.isArray(data.fields) ? data.fields.filter((f): f is string => typeof f === "string") : [];
        if (fields.includes("file")) {
          // The upload is unusable: it has to be sent again.
          patchRow(row.key, { status: "failed", ticket: null, textCheck: null, fileError: FILE_REJECTED, retryable: files.current.has(row.key), errors: {}, error: null });
          return;
        }
        patchRow(row.key, {
          status: "ready",
          errors: Object.fromEntries(fields.map((f) => [f, "Check this value."])),
          error: "Not saved. Check the marked values.",
        });
        return;
      }
      patchRow(row.key, {
        status: "ready",
        error: response.status === 401 ? "Your session has ended. Redirecting to sign in." : "Not saved. Something went wrong; try again.",
      });
    } catch {
      patchRow(row.key, { status: "ready", error: "Not saved. Could not reach the server; try again." });
    }
  }

  async function saveAll() {
    if (!course) return;
    const targets = rows.filter((r) => r.status === "ready");
    setSaving(true);
    setSaved(null);
    setRows((current) => current.map((r) => (r.status === "ready" ? { ...r, status: "saving", errors: {}, error: null } : r)));
    let index = 0;
    const worker = async () => {
      while (index < targets.length) await saveRow(targets[index++], course.code);
    };
    await Promise.all(Array.from({ length: SAVE_CONCURRENCY }, worker));
    setSaving(false);
  }

  const busy = rows.some((r) => r.status === "queued" || r.status === "uploading");
  const ready = rows.filter((r) => r.status === "ready");
  const invalid = ready.some((r) => Object.keys(rowProblems(r)).length > 0);
  const failedCount = rows.filter((r) => r.status === "failed").length;
  let hint: string | null = null;
  if (!course) hint = "Choose a course to save.";
  else if (busy) hint = "Uploading. You can save when every file is done.";
  else if (invalid) hint = "Fix the marked rows to save.";
  else if (ready.length === 0 && rows.length > 0) hint = "No file is ready to save.";
  const canSave = course !== undefined && !busy && !saving && !invalid && ready.length > 0;
  const saveLabel = saving ? "Saving..." : `${isPublished ? "Save and publish" : "Save as drafts"}${ready.length ? ` (${ready.length})` : ""}`;

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2 md:items-start">
        <div className="space-y-2">
          <Label htmlFor="bulk-course">Course</Label>
          <NativeSelect
            id="bulk-course"
            value={courseId}
            disabled={saving}
            onChange={(e) => changeCourse(e.target.value)}
            className="w-full [&_select]:h-11 md:[&_select]:h-9"
          >
            <NativeSelectOption value="" disabled>
              Choose a course
            </NativeSelectOption>
            {courses.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.code} - {c.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-sm text-muted-foreground">Every file in this batch goes into this course.</p>
        </div>

        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-sm font-medium text-heading">Visibility of the whole batch</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: false, label: "Drafts", text: "Only you can see them." },
              { value: true, label: "Published", text: "Visible to students." },
            ].map((choice) => (
              <label
                key={choice.label}
                className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50"
              >
                <input
                  type="radio"
                  name="bulk-visibility"
                  checked={isPublished === choice.value}
                  disabled={saving}
                  onChange={() => setIsPublished(choice.value)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <b className="block text-sm font-medium text-heading">{choice.label}</b>
                  <small className="block text-[0.8125rem] leading-snug text-muted-foreground">{choice.text}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center ${dragging ? "border-primary bg-muted" : "border-input"}`}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Drop PDFs here, up to {MAX_FILES} files of {MAX_SIZE_LABEL} each.
        </p>
        <input
          ref={inputRef}
          id="bulk-files"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          aria-label="PDF files"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button type="button" variant="outline" disabled={saving || rows.length >= MAX_FILES} onClick={() => inputRef.current?.click()} className="h-11 md:h-9">
          Choose files
        </Button>
        {notice && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {notice}
          </p>
        )}
      </div>

      {saved && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-primary/40 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <b>{saved.count} saved.</b>
          <Link href={`/admin?course=${encodeURIComponent(saved.code)}`} className="font-medium underline underline-offset-4">
            See them in {saved.code}
          </Link>
        </p>
      )}

      {rows.length > 0 && (
        <section className="space-y-3" aria-label="Files in this batch">
          <h2 className="text-lg font-semibold text-heading">
            {rows.length} {rows.length === 1 ? "file" : "files"}
            {failedCount > 0 && <span className="text-sm font-normal text-muted-foreground"> - {failedCount} cannot be saved</span>}
          </h2>
          <div aria-hidden className={`hidden gap-x-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid ${BULK_COLUMNS}`}>
            <span>Title</span>
            <span>Type</span>
            <span>Chapter</span>
            <span>Year</span>
            <span>Session</span>
            <span>Language</span>
            <span />
          </div>
          <ul className="space-y-2">
            {rows.map((row) => (
              <BulkRowView
                key={row.key}
                row={row}
                chapters={courseChapters}
                years={academicYearOptions(currentYear, row.yearStart ? Number(row.yearStart) : null)}
                disabled={saving}
                onEdit={(patch) => editRow(row.key, patch)}
                onRemove={() => removeRow(row.key)}
                onRetry={() => retryRow(row.key)}
              />
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!canSave} onClick={() => void saveAll()} className="h-11 px-4 md:h-9">
              {saveLabel}
            </Button>
            <Link href="/admin" className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}>
              Cancel
            </Link>
            {hint && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {hint}
              </p>
            )}
          </div>
        </section>
      )}

      <AlertDialog open={pendingCourseId !== null} onOpenChange={(open) => !open && setPendingCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the course?</AlertDialogTitle>
            <AlertDialogDescription>The chapters you chose belong to the current course and will be cleared. The files stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the course</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingCourseId !== null && applyCourse(pendingCourseId)}>Change course</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
