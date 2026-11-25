// PROTOTYPE (throwaway): the proposed shared design language, in one place.
//  - every year has its own colour (circle, chip, tab, hover border), used the same way on every page
//  - every file type has its own colour and icon, used the same way on every row
//  - big radii (2xl/3xl), tinted surfaces, one soft lift on hover, a little motion on arrival
import { BookOpen, ClipboardCheck, FileText, PencilLine } from "lucide-react";

export type YearKey = 1 | 2 | 3 | 4;

export const YEAR_STYLE: Record<YearKey, { label: string; badge: string; solid: string; chip: string; border: string; tint: string; text: string }> = {
  1: { label: "First year", badge: "1", solid: "bg-sky-700 text-white", chip: "bg-sky-500/15 text-sky-800 dark:text-sky-300", border: "hover:border-sky-500/70", tint: "from-sky-500/20", text: "text-sky-700 dark:text-sky-300" },
  2: { label: "Second year", badge: "2", solid: "bg-violet-600 text-white", chip: "bg-violet-500/15 text-violet-800 dark:text-violet-300", border: "hover:border-violet-500/70", tint: "from-violet-500/20", text: "text-violet-700 dark:text-violet-300" },
  3: { label: "Third year", badge: "3", solid: "bg-emerald-700 text-white", chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", border: "hover:border-emerald-500/70", tint: "from-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300" },
  4: { label: "Master 1", badge: "M1", solid: "bg-amber-400 text-black", chip: "bg-amber-500/20 text-amber-900 dark:text-amber-300", border: "hover:border-amber-500/70", tint: "from-amber-500/25", text: "text-amber-800 dark:text-amber-300" },
};

export const TYPE_STYLE = {
  lecture: { label: "Lecture", icon: BookOpen, chip: "bg-blue-500/15 text-blue-800 dark:text-blue-300" },
  notes: { label: "Notes", icon: FileText, chip: "bg-teal-500/15 text-teal-800 dark:text-teal-300" },
  exercise: { label: "Exercise", icon: PencilLine, chip: "bg-orange-500/15 text-orange-800 dark:text-orange-300" },
  exam: { label: "Exam", icon: ClipboardCheck, chip: "bg-rose-500/15 text-rose-800 dark:text-rose-300" },
} as const;

export interface SampleCourse { code: string; title: string; files: number; semester: 1 | 2 }

export const SAMPLE_COURSES: Record<YearKey, SampleCourse[]> = {
  1: [
    { code: "DEMO110", title: "Intro to Programming", files: 14, semester: 1 },
    { code: "DEMO120", title: "Discrete Mathematics", files: 11, semester: 1 },
    { code: "DEMO130", title: "Computer Architecture", files: 9, semester: 2 },
    { code: "DEMO210", title: "Web Basics", files: 12, semester: 2 },
  ],
  2: [
    { code: "DEMO301", title: "Algorithms", files: 13, semester: 1 },
    { code: "DEMO310", title: "Databases", files: 16, semester: 1 },
    { code: "DEMO320", title: "Operating Systems", files: 10, semester: 2 },
    { code: "DEMO330", title: "Computer Networks", files: 8, semester: 2 },
  ],
  3: [
    { code: "DEMO510", title: "Software Engineering", files: 15, semester: 1 },
    { code: "DEMO521", title: "Compilers", files: 9, semester: 1 },
    { code: "DEMO530", title: "Artificial Intelligence", files: 12, semester: 2 },
    { code: "DEMO540", title: "Information Security", files: 7, semester: 2 },
  ],
  4: [],
};

export const SAMPLE_LATEST = [
  { title: "Final exam 2025", course: "DEMO301", type: "exam", when: "Today" },
  { title: "Chapter 4: Graphs", course: "DEMO301", type: "lecture", when: "Yesterday" },
  { title: "Exercise sheet 3 + solution", course: "DEMO310", type: "exercise", when: "2 days ago" },
  { title: "Normalisation notes", course: "DEMO310", type: "notes", when: "3 days ago" },
] as const;
