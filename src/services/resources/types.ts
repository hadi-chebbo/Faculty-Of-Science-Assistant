import type { ExamSession, Language, ResourceType } from "@/db/constants";

export interface ResourceListItem {
  id: string;
  courseCode: string;
  type: ResourceType;
  title: string;
  description: string | null;
  academicYearStart: number | null;
  examSession: ExamSession | null;
  language: Language;
  isPublished: boolean;
  // Whether opening it can lead anywhere (a link or a stored file). Neither value is exposed.
  hasSource: boolean;
  // Solutions of this resource that the viewer may see.
  solutions: ResourceRef[];
}

// A pointer to a related resource (the exam a solution answers, or a solution of an exam).
export interface ResourceRef {
  id: string;
  type: ResourceType;
  title: string;
}

export interface ResourceDetail extends ResourceListItem {
  courseTitle: string;
  solutionOf: ResourceRef | null;
}

// Where opening a resource leads. Only a URL for now; stored files will bring signed URLs.
export interface ResourceLink {
  url: string;
}

// The values the exam filters can offer, each with at least one visible exam behind it.
export interface ExamFilterOptions {
  semesters: number[];
  // Ordered by code.
  courses: { code: string; title: string; semester: number }[];
  // Start years, newest first.
  years: number[];
  sessions: ExamSession[];
}

// Everything the admin edit form needs. The stored file's key is never exposed, only whether one exists.
export interface ResourceForEdit {
  id: string;
  courseId: string;
  type: ResourceType;
  title: string;
  description: string | null;
  academicYearStart: number | null;
  examSession: ExamSession | null;
  language: Language;
  externalUrl: string | null;
  isPublished: boolean;
  hasFile: boolean;
  chapterId: string | null;
  solutionOf: { id: string; title: string } | null;
  // How many resources, drafts included, are a solution of this one.
  solutionCount: number;
}
