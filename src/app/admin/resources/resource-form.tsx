"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TITLE_MAX_LENGTH, RESOURCE_TYPES } from "@/db/constants";
import type { ExamSession, Language, ResourceType } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, RESOURCE_TYPE_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ChapterOption } from "@/services/chapters/options";
import type { CourseOption } from "@/services/courses/types";
import type { SolutionTarget } from "@/services/resources/solution-targets";
import type { ResourceForEdit } from "@/services/resources/types";
import { deleteNotes } from "./delete-notes";

const FIELD_MESSAGES: Record<string, string> = {
  isPublished: "Add a link before publishing.",
  examSession: "Choose a session for an exam.",
  chapterId: "Choose a chapter of this course.",
  solutionOfId: "Choose an exercise or exam of this course.",
};

const fieldClass = "h-11 md:h-9";
const selectClass = "w-full [&_select]:h-11 md:[&_select]:h-9";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// A labelled group of fields.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-1 w-full border-b pb-2 text-base font-semibold text-heading">{title}</legend>
      {children}
    </fieldset>
  );
}

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
  const [courseId, setCourseId] = useState(resource?.courseId ?? "");
  const [chapterId, setChapterId] = useState(resource?.chapterId ?? "");
  const [solutionOfId, setSolutionOfId] = useState(resource?.solutionOf?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
      externalUrl: hasFile ? null : text("externalUrl"),
      solutionOfId: type === "solution" && solutionOfId ? solutionOfId : null,
      chapterId: type !== "exam" && chapterId ? chapterId : null,
      isPublished: form.get("isPublished") === "on",
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
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Card className="pb-0">
        <CardContent className="gap-8">
          <Section title="Basics">
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

            <Field id="type" label="Type" error={errors.type}>
              <NativeSelect id="type" name="type" value={type} onChange={(e) => setType(e.target.value as ResourceType)} aria-invalid={invalid("type")} className={selectClass}>
                {RESOURCE_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {RESOURCE_TYPE_LABELS[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            {type !== "exam" && (
              <Field id="chapterId" label="Chapter" hint="Material with no chapter is listed under Other material." error={errors.chapterId}>
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

            <Field id="title" label="Title" error={errors.title}>
              <Input id="title" name="title" required maxLength={RESOURCE_TITLE_MAX_LENGTH} defaultValue={resource?.title ?? ""} aria-invalid={invalid("title")} className={fieldClass} />
            </Field>

            <Field id="description" label="Description" error={errors.description}>
              <Textarea id="description" name="description" rows={3} defaultValue={resource?.description ?? ""} aria-invalid={invalid("description")} />
            </Field>
          </Section>

          <Section title="Details">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <Field id="academicYearStart" label="Academic year start" hint="2024 means 2024-2025." error={errors.academicYearStart}>
                <Input id="academicYearStart" name="academicYearStart" type="number" inputMode="numeric" defaultValue={resource?.academicYearStart ?? ""} aria-invalid={invalid("academicYearStart")} className={fieldClass} />
              </Field>

              <Field id="language" label="Language" error={errors.language}>
                <NativeSelect id="language" name="language" defaultValue={resource?.language ?? "en"} aria-invalid={invalid("language")} className={selectClass}>
                  {LANGUAGES.map((l: Language) => (
                    <NativeSelectOption key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              {type === "exam" && (
                <Field id="examSession" label="Exam session" error={errors.examSession}>
                  <NativeSelect id="examSession" name="examSession" defaultValue={resource?.examSession ?? ""} aria-invalid={invalid("examSession")} className={selectClass}>
                    <NativeSelectOption value="">Choose a session</NativeSelectOption>
                    {EXAM_SESSIONS.map((s: ExamSession) => (
                      <NativeSelectOption key={s} value={s}>
                        {EXAM_SESSION_LABELS[s]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
          </Section>

          <Section title="Source and publishing">
            <Field
              id="externalUrl"
              label="Link"
              hint={hasFile ? "This resource has a stored file." : "An https:// address."}
              error={errors.externalUrl}
            >
              <Input id="externalUrl" name="externalUrl" type="url" disabled={hasFile} defaultValue={resource?.externalUrl ?? ""} placeholder="https://" aria-invalid={invalid("externalUrl")} className={fieldClass} />
            </Field>

            <div className="space-y-2">
              <div className="flex min-h-11 items-center gap-2 md:min-h-0">
                <Checkbox id="isPublished" name="isPublished" defaultChecked={resource?.isPublished ?? false} aria-invalid={invalid("isPublished")} />
                <Label htmlFor="isPublished">Published</Label>
              </div>
              {errors.isPublished && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {errors.isPublished}
                </p>
              )}
            </div>
          </Section>

          {formError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex-wrap justify-between gap-2 border-t bg-muted/50 py-4">
          {resource ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
              className="h-11 px-4 text-destructive hover:text-destructive md:h-9"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Link href="/admin" className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}>
              Cancel
            </Link>
            <Button type="submit" disabled={pending} className="h-11 px-4 md:h-9">
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardFooter>
      </Card>

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
