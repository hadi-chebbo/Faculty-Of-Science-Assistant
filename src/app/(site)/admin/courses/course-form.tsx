"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type Ref } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { COURSE_CODE_MAX_LENGTH, COURSE_TITLE_MAX_LENGTH, SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";
import { useHydrated } from "@/lib/use-hydrated";

export interface CourseValues {
  code: string;
  title: string;
  semester: string;
}

const SEMESTERS = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => SEMESTER_MIN + i);
const FIELD_MESSAGES: Record<string, string> = {
  code: "Use 2 to 20 letters and digits.",
  title: `Enter a title of 1 to ${COURSE_TITLE_MAX_LENGTH} characters.`,
  semester: `Choose a semester from ${SEMESTER_MIN} to ${SEMESTER_MAX}.`,
};
const TAKEN_MESSAGE = "A course with this code already exists.";

type Errors = Partial<Record<keyof CourseValues, string>>;

// The three course fields with their save request. Used for a new course (POST) and for the edit
// dialog (PATCH). Field errors from the server show under the field; typed values are kept.
export function CourseForm({
  idPrefix,
  initial,
  url,
  method,
  submitLabel,
  savedMessage,
  clearOnSuccess,
  onSaved,
  codeRef,
  codeHint,
  stacked,
}: {
  idPrefix: string;
  initial: CourseValues;
  url: string;
  method: "POST" | "PATCH";
  submitLabel: string;
  savedMessage: string;
  clearOnSuccess?: boolean;
  onSaved?: () => void;
  codeRef?: Ref<HTMLInputElement>;
  codeHint: string;
  // One field per line at every width (the edit dialog); otherwise one row from md up.
  stacked?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof CourseValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const response = await adminFetch(
        url,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: values.code, title: values.title, semester: Number(values.semester) }),
        },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        toast.success(savedMessage);
        if (clearOnSuccess) setValues(initial);
        router.refresh();
        onSaved?.();
        return;
      }
      if (response.status === 401) {
        toast.error("Your session has ended. Redirecting to sign in.");
      } else if (response.status === 409) {
        setErrors({ code: TAKEN_MESSAGE });
      } else if (response.status === 400) {
        const data: { fields?: unknown } = await response.json().catch(() => ({}));
        const next: Errors = {};
        for (const field of Array.isArray(data.fields) ? data.fields : []) {
          if (field in FIELD_MESSAGES) next[field as keyof CourseValues] = FIELD_MESSAGES[field];
        }
        if (Object.keys(next).length > 0) setErrors(next);
        else toast.error("Something went wrong. Please try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const error = (key: keyof CourseValues) =>
    errors[key] ? (
      <p id={`${idPrefix}-${key}-error`} className="mt-1.5 text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className={stacked ? "grid gap-4" : "grid gap-4 md:grid-cols-[1fr_2fr_1fr_auto] md:items-start"}
    >
      <div>
        <Label htmlFor={`${idPrefix}-code`} className="mb-1.5">Code</Label>
        <Input
          id={`${idPrefix}-code`}
          ref={codeRef}
          value={values.code}
          onChange={(e) => set("code")(e.target.value)}
          maxLength={COURSE_CODE_MAX_LENGTH + 10}
          autoComplete="off"
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={`${idPrefix}-code-hint${errors.code ? ` ${idPrefix}-code-error` : ""}`}
          className="h-11 md:h-9"
        />
        <p id={`${idPrefix}-code-hint`} className="mt-1.5 text-xs text-muted-foreground">{codeHint}</p>
        {error("code")}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-title`} className="mb-1.5">Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => set("title")(e.target.value)}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
          className="h-11 md:h-9"
        />
        {error("title")}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-semester`} className="mb-1.5">Semester</Label>
        <NativeSelect
          id={`${idPrefix}-semester`}
          value={values.semester}
          onChange={(e) => set("semester")(e.target.value)}
          className="w-full [&_select]:h-11 md:[&_select]:h-9"
        >
          {SEMESTERS.map((n) => (
            <NativeSelectOption key={n} value={String(n)}>Semester {n}</NativeSelectOption>
          ))}
        </NativeSelect>
        {error("semester")}
      </div>
      <Button type="submit" disabled={pending || !hydrated} className={stacked ? "h-11 px-4 md:h-9 md:px-3" : "h-11 px-4 md:mt-[1.625rem] md:h-9 md:px-3"}>
        {submitLabel}
      </Button>
    </form>
  );
}
