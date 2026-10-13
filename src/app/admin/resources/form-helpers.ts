import type { ResourceType } from "@/db/constants";
import { RESOURCE_TYPE_LABELS, formatAcademicYear } from "@/lib/labels";

const YEARS_BACK = 15;

export interface YearOption {
  value: string;
  label: string;
}

// The academic years the form offers, newest first: the one starting in `currentYear` down to 15
// years before it, plus the stored year when it falls outside that range. The value is the start year.
export function academicYearOptions(currentYear: number, stored: number | null): YearOption[] {
  const starts: number[] = [];
  for (let start = currentYear; start >= currentYear - YEARS_BACK; start--) starts.push(start);
  if (stored !== null && !starts.includes(stored)) {
    starts.push(stored);
    starts.sort((a, b) => b - a);
  }
  return starts.map((start) => ({ value: String(start), label: formatAcademicYear(start) }));
}

// Where students will find the resource: "In DEMO510 › Chapter 2 › Lectures". Exams are listed
// together, whatever their chapter; with no chapter a resource is listed under Other material.
export function previewWhere(courseCode: string, type: ResourceType, chapterPosition: number | null): string {
  if (!courseCode) return "Choose a course to see where it will appear.";
  if (type === "exam") return `In ${courseCode} › Previous exams`;
  const place = chapterPosition === null ? "Other material" : `Chapter ${chapterPosition}`;
  return `In ${courseCode} › ${place} › ${RESOURCE_TYPE_LABELS[type]}`;
}

// "12 Oct 2026". A fixed locale and time zone, so the server and the browser print the same text.
export function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
