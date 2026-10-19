"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EXAM_SESSIONS, RESOURCE_TITLE_MAX_LENGTH } from "@/db/constants";
import type { ExamSession, Language, ResourceType } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";
import { EXAM_SESSION_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ChapterOption } from "@/services/chapters/options";
import type { CourseOption } from "@/services/courses/types";
import type { SolutionTarget } from "@/services/resources/solution-targets";
import type { ResourceForEdit } from "@/services/resources/types";
import { LanguageSwitch, TypeChooser } from "./choice-groups";
import { deleteNotes } from "./delete-notes";
import { academicYearOptions } from "./form-helpers";
import { Field, FormCard, RadioField, fieldClass, selectClass } from "./form-parts";
import { FileField } from "./file-field";
import { FormPreview } from "./form-preview";
import { VisibilityCard } from "./visibility-card";

const FIELD_MESSAGES: Record<string, string> = {
  file: "The file could not be checked. Upload a PDF of at most 50 MB.",
  isPublished: "Add a file or link before publishing.",
  examSession: "Choose a session for an exam.",
  chapterId: "Choose a chapter of this course.",
  solutionOfId: "Choose an exercise or exam of this course.",
};

// "2024-2025 Final - Title" for an exam, the title for an exercise.
function targetLabel(t: SolutionTarget): string {
  if (t.type === "exercise") return t.title;
  const when = [t.academicYearStart === null ? null : formatAcademicYear(t.academicYearStart), t.examSession ? EXAM_SESSION_LABELS[t.examSession] : null];
  return `${when.filter(Boolean).join(" ")} - ${t.title}`.replace(/^ - /, "");
}

// Creates a resource, or edits `resource` when given.
// The chapter choice is kept in state when the type switches to "exam" (it is then hidden and not
// sent) and is cleared when the course changes. So is the "Solution of" choice, which is shown only
// for type "solution" and offers the exercises and exams of the chosen course.
export function ResourceForm({
  courses,
  chapters,
  solutionTargets,
  resource,
}: {
  courses: CourseOption[];
  chapters: ChapterOption[];
  solutionTargets: SolutionTarget[];
  resource?: ResourceForEdit;
}) {
  const router = useRouter();
  const [type, setType] = useState<ResourceType>(resource?.type ?? "lecture");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [courseId, setCourseId] = useState(resource?.courseId ?? "");
  const [chapterId, setChapterId] = useState(resource?.chapterId ?? "");
  const [solutionOfId, setSolutionOfId] = useState(resource?.solutionOf?.id ?? "");
  const [yearStart, setYearStart] = useState(resource?.academicYearStart == null ? "" : String(resource.academicYearStart));
  const [examSession, setExamSession] = useState<ExamSession | "">(resource?.examSession ?? "");
  const [language, setLanguage] = useState<Language>(resource?.language ?? "en");
  const [isPublished, setIsPublished] = useState(resource?.isPublished ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [fileTicket, setFileTicket] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [yearOptions] = useState(() => academicYearOptions(new Date().getFullYear(), resource?.academicYearStart ?? null));
  const hasFile = resource?.hasFile ?? false;
  const courseChapters = chapters.filter((c) => c.courseId === courseId);
  const courseTargets = solutionTargets.filter((t) => t.courseId === courseId && t.id !== resource?.id);
  const exerciseTargets = courseTargets.filter((t) => t.type === "exercise");
  const examTargets = courseTargets.filter((t) => t.type === "exam");
  // A stored link to something that is not an exercise or exam stays selectable, so saving keeps it.
  const keptSolution = resource?.solutionOf && !courseTargets.some((t) => t.id === resource.solutionOf?.id) ? resource.solutionOf : null;
  const keptSelected = keptSolution !== null && solutionOfId === keptSolution.id;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const body = {
      courseId: text("courseId"),
      type,
      title: text("title"),
      description: text("description"),
      academicYearStart: text("academicYearStart"),
      examSession: type === "exam" ? text("examSession") : null,
      language: text("language"),
      externalUrl: text("externalUrl"),
      solutionOfId: type === "solution" && solutionOfId ? solutionOfId : null,
      chapterId: type !== "exam" && chapterId ? chapterId : null,
      isPublished,
      ...(fileTicket ? { fileTicket } : {}),
    };

    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await adminFetch(
        resource ? `/api/v1/resources/${resource.id}` : "/api/v1/resources",
        { method: resource ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      if (response.status === 400) {
        const data: { fields?: unknown } = await response.json().catch(() => ({}));
        const fields = Array.isArray(data.fields) ? data.fields.filter((f): f is string => typeof f === "string") : [];
        setErrors(Object.fromEntries(fields.map((f) => [f, FIELD_MESSAGES[f] ?? "Check this value."])));
        // That upload is unusable: the admin has to choose the file again.
        if (fields.includes("file")) setFileTicket(null);
        setFormError("The resource was not saved. Check the marked fields.");
      } else if (response.status === 401) {
        setFormError("Your session has ended. Redirecting to sign in.");
        return;
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  async function onDelete() {
    if (!resource) return;
    setPending(true);
    setFormError(null);
    try {
      const response = await adminFetch(`/api/v1/resources/${resource.id}`, { method: "DELETE" }, () => router.replace("/sign-in"));
      // 404: already deleted elsewhere, which is the state the admin asked for.
      if (response.ok || response.status === 404) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setConfirmingDelete(false);
      if (response.status === 401) {
        setFormError("Your session has ended. Redirecting to sign in.");
        return;
      }
      setFormError("Something went wrong. Please try again.");
    } catch {
      setConfirmingDelete(false);
      setFormError("Could not reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <FormCard title="What is it?" description="The type decides which of the fields below apply.">
          <RadioField id="type" legend="Type" error={errors.type}>
            <TypeChooser value={type} onChange={setType} />
          </RadioField>

          <Field id="title" label="Title" error={errors.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={RESOURCE_TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={invalid("title")}
              className={fieldClass}
            />
          </Field>

          <Field id="description" label="Description" optional error={errors.description}>
            <Textarea id="description" name="description" rows={3} defaultValue={resource?.description ?? ""} aria-invalid={invalid("description")} />
          </Field>
        </FormCard>

        <FormCard title="Where does it belong?" description="Students find it under this course and chapter.">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <Field id="courseId" label="Course" error={errors.courseId}>
              <NativeSelect
                id="courseId"
                name="courseId"
                required
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setChapterId("");
                  setSolutionOfId("");
                }}
                aria-invalid={invalid("courseId")}
                className={selectClass}
              >
                {!resource && <NativeSelectOption value="" disabled>Choose a course</NativeSelectOption>}
                {courses.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            {type !== "exam" && (
              <Field id="chapterId" label="Chapter" hint="With no chapter it is listed under Other material." error={errors.chapterId}>
                <NativeSelect
                  id="chapterId"
                  name="chapterId"
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  disabled={courseChapters.length === 0}
                  aria-invalid={invalid("chapterId")}
                  className={selectClass}
                >
                  {courseChapters.length === 0 ? (
                    <NativeSelectOption value="">{courseId ? "No chapters in this course" : "Choose a course first"}</NativeSelectOption>
                  ) : (
                    <>
                      <NativeSelectOption value="">No chapter</NativeSelectOption>
                      {courseChapters.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.position}. {c.title}
                        </NativeSelectOption>
                      ))}
                    </>
                  )}
                </NativeSelect>
              </Field>
            )}
          </div>

          {type === "solution" && (
            <Field
              id="solutionOfId"
              label="Solution of"
              hint="The exercise or exam this solution answers. Students see it as a Solution link on that row."
              error={errors.solutionOfId}
            >
              <NativeSelect
                id="solutionOfId"
                name="solutionOfId"
                value={solutionOfId}
                onChange={(e) => setSolutionOfId(e.target.value)}
                disabled={courseTargets.length === 0 && !keptSelected}
                aria-invalid={invalid("solutionOfId")}
                className={selectClass}
              >
                {courseTargets.length === 0 && !keptSelected ? (
                  <NativeSelectOption value="">{courseId ? "No exercises or exams in this course" : "Choose a course first"}</NativeSelectOption>
                ) : (
                  <>
                    <NativeSelectOption value="">Not linked</NativeSelectOption>
                    {keptSelected && <NativeSelectOption value={keptSolution.id}>{keptSolution.title}</NativeSelectOption>}
                    {exerciseTargets.length > 0 && (
                      <NativeSelectOptGroup label="Exercises">
                        {exerciseTargets.map((t) => (
                          <NativeSelectOption key={t.id} value={t.id}>
                            {targetLabel(t)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    )}
                    {examTargets.length > 0 && (
                      <NativeSelectOptGroup label="Exams">
                        {examTargets.map((t) => (
                          <NativeSelectOption key={t.id} value={t.id}>
                            {targetLabel(t)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    )}
                  </>
                )}
              </NativeSelect>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            {type === "exam" && (
              <Field id="examSession" label="Exam session" error={errors.examSession}>
                <NativeSelect
                  id="examSession"
                  name="examSession"
                  value={examSession}
                  onChange={(e) => setExamSession(e.target.value as ExamSession | "")}
                  aria-invalid={invalid("examSession")}
                  className={selectClass}
                >
                  <NativeSelectOption value="">Choose a session</NativeSelectOption>
                  {EXAM_SESSIONS.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {EXAM_SESSION_LABELS[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field id="academicYearStart" label="Academic year" optional={type !== "exam"} error={errors.academicYearStart}>
              <NativeSelect
                id="academicYearStart"
                name="academicYearStart"
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value)}
                aria-invalid={invalid("academicYearStart")}
                className={selectClass}
              >
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {yearOptions.map((y) => (
                  <NativeSelectOption key={y.value} value={y.value}>
                    {y.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <RadioField id="language" legend="Language" error={errors.language}>
              <LanguageSwitch value={language} onChange={setLanguage} />
            </RadioField>
          </div>
        </FormCard>

        <FormCard title="The material" description="A PDF file. A backup link is optional.">
          <FileField
            id="file"
            ticket={fileTicket}
            onTicketChange={setFileTicket}
            onUploadingChange={(value) => {
              setUploading(value);
              if (value) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== "file")));
            }}
            storedFileHref={resource && hasFile ? `/api/v1/resources/${resource.id}/open` : undefined}
            serverError={errors.file}
            onSignedOut={() => router.replace("/sign-in")}
          />

          <Field id="externalUrl" label="Backup link" optional hint="Shown beside the file, in case it fails to open (https://)." error={errors.externalUrl}>
            <Input
              id="externalUrl"
              name="externalUrl"
              type="url"
              defaultValue={resource?.externalUrl ?? ""}
              placeholder="https://"
              aria-invalid={invalid("externalUrl")}
              className={fieldClass}
            />
          </Field>
        </FormCard>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
        <VisibilityCard
          isPublished={isPublished}
          onChange={setIsPublished}
          error={errors.isPublished}
          formError={formError}
          pending={pending}
          uploading={uploading}
          canDelete={resource !== undefined}
          onDelete={() => setConfirmingDelete(true)}
        />
        <FormPreview
          type={type}
          title={title}
          language={language}
          academicYearStart={yearStart ? Number(yearStart) : null}
          examSession={examSession || null}
          courseCode={courses.find((c) => c.id === courseId)?.code ?? ""}
          chapterPosition={courseChapters.find((c) => c.id === chapterId)?.position ?? null}
        />
      </aside>

      {resource && (
        <AlertDialog open={confirmingDelete} onOpenChange={(open) => !open && !pending && setConfirmingDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{resource.title}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            {deleteNotes(resource.isPublished, resource.solutionCount).map((note) => (
              <p key={note} className="text-sm text-muted-foreground">
                {note}
              </p>
            ))}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  void onDelete();
                }}
              >
                {pending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  );
}
