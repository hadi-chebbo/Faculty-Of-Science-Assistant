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
  solutions: ResourceRef[];
}
