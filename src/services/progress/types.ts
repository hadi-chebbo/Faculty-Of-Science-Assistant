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
