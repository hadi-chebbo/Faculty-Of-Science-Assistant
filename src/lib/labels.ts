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

export const EXAM_SESSION_LABELS: Record<ExamSession, string> = {
  partial: "Partial",
  final: "Final",
  second: "Second session",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "EN",
  fr: "FR",
};

// An academic year is stored by its start year: 2024 is shown as "2024-2025".
export function formatAcademicYear(start: number): string {
  return `${start}-${start + 1}`;
}
