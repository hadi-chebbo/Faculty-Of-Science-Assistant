import type { ResourceType } from "@/db/constants";
import type { ResourceListItem } from "../resources/types";

export interface CourseSummary {
  code: string;
  title: string;
  semester: number;
  resourceCount: number;
}

// A course to choose from in the admin area.
export interface CourseOption {
  id: string;
  code: string;
  title: string;
  semester: number;
}

export interface ResourceGroup {
  type: ResourceType;
  resources: ResourceListItem[];
}

export interface ChapterOutline {
  id: string;
  position: number;
  title: string;
  // Rows listed in this chapter; solution links nested under a row are not counted.
  itemCount: number;
  groups: ResourceGroup[];
}

// The course as it is taught. Exams are apart; a solution linked to a visible resource is not
// listed on its own (it is a link on that resource's row).
export interface CourseOutline {
  // Every chapter in position order, empty ones included.
  chapters: ChapterOutline[];
  // Non-exam resources with no chapter.
  general: ResourceGroup[];
  // Newest academic year first.
  exams: ResourceListItem[];
}

export interface CourseDetail {
  code: string;
  title: string;
  semester: number;
  // Only types that have at least one visible resource, in the order of RESOURCE_TYPES.
  groups: ResourceGroup[];
  outline: CourseOutline;
}
