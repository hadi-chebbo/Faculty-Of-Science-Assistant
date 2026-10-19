import type { ResourceType } from "@/db/constants";

// Where "back" leads from a resource: the part of its course page that lists it. An exam is in
// Previous exams, a resource of a chapter is on that chapter's page, and anything else is in the
// course's general material (the Other material area when the course has chapters).
export function readerBackTarget(resource: {
  courseCode: string;
  type: ResourceType;
  chapterPosition: number | null;
  courseHasChapters: boolean;
}): string {
  const course = `/courses/${encodeURIComponent(resource.courseCode)}`;
  if (resource.type === "exam") return `${course}?tab=exams`;
  if (resource.chapterPosition !== null) return `${course}/chapters/${resource.chapterPosition}`;
  return resource.courseHasChapters ? `${course}?tab=other` : course;
}
