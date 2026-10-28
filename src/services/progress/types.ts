// Progress of one student, computed live from their completions of published files.
export interface Progress {
  // Counted resources of the whole course, in a chapter or in General.
  course: { code: string; done: number; total: number; finished: boolean };
  // Published exams of the course, never merged into the course figure.
  exams: { done: number; total: number };
  // The chapter of the marked file, or null for a file in General or an exam.
  chapter: { id: string; position: number; title: string; done: number; total: number; finished: boolean } | null;
}

export interface MarkResult {
  // False when the file was already marked done.
  created: boolean;
  progress: Progress;
}

// Progress of one student over a whole course (the course page). Counted files only, except `exams`.
export interface CourseProgress {
  course: { code: string; title: string; done: number; total: number; finished: boolean };
  exams: { done: number; total: number };
  // Every chapter of the course by position, including ones with total 0.
  chapters: { id: string; position: number; title: string; done: number; total: number; finished: boolean }[];
  // Counted files with no chapter.
  general: { done: number; total: number; finished: boolean };
}

// The progress page: one entry per course where the student has marked a published file as done.
export interface ProgressOverview {
  // The current Beirut week: its Monday, today, and the student's active days in it (all
  // "YYYY-MM-DD", days ascending).
  week: { start: string; today: string; activeDays: string[] };
  // True once the student has ever marked a file (a completion or a kept active day exists).
  hasCompletions: boolean;
  // By semester, then course code. Same figures as `CourseProgress`, without the exams of other courses.
  courses: {
    code: string;
    title: string;
    semester: number;
    // ISO time of the latest completion in the course.
    lastCompletedAt: string;
    course: { done: number; total: number; finished: boolean };
    exams: { done: number; total: number };
    chapters: { id: string; position: number; title: string; done: number; total: number; finished: boolean }[];
    general: { done: number; total: number; finished: boolean };
  }[];
}
