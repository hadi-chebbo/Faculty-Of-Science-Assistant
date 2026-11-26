import type { ExamSession, Language, ResourceType } from "@/db/constants";

// Human-readable labels for database values. The only place they are defined.
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  lecture: "Lectures",
  notes: "Notes",
  exercise: "Exercises",
  exam: "Exams",
  solution: "Solutions",
  other: "Other",
};

// One item of each type, for choosing a type. RESOURCE_TYPE_LABELS above is the plural, for headings.
export const RESOURCE_TYPE_SINGULAR_LABELS: Record<ResourceType, string> = {
  lecture: "Lecture",
  notes: "Notes",
  exercise: "Exercise",
  exam: "Exam",
  solution: "Solution",
  other: "Other",
};

export const EXAM_SESSION_LABELS: Record<ExamSession, string> = {
  partial: "Partial",
  final: "Final",
  second: "Second session",
};

// The full name, where there is room (the short form is for dense rows).
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "French",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "EN",
  fr: "FR",
};

const RESOURCE_TYPE_COUNT_NAMES: Record<ResourceType, [one: string, many: string]> = {
  lecture: ["lecture", "lectures"],
  notes: ["note", "notes"],
  exercise: ["exercise", "exercises"],
  exam: ["exam", "exams"],
  solution: ["solution", "solutions"],
  other: ["other item", "other items"],
};

// What a list of groups holds, one entry per non-empty type in the order given: { type, label: "3 lectures" }.
export function groupCounts<T extends ResourceType>(
  groups: { type: T; resources: unknown[] }[],
): { type: T; label: string }[] {
  return groups
    .filter((group) => group.resources.length > 0)
    .map((group) => {
      const count = group.resources.length;
      const [one, many] = RESOURCE_TYPE_COUNT_NAMES[group.type];
      return { type: group.type, label: `${count} ${count === 1 ? one : many}` };
    });
}

// An academic year is stored by its start year: 2024 is shown as "2024-2025".
export function formatAcademicYear(start: number): string {
  return `${start}-${start + 1}`;
}
