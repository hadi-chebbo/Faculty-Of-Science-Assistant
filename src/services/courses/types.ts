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

export interface CourseDetail {
  code: string;
  title: string;
  semester: number;
  // Only types that have at least one visible resource, in the order of RESOURCE_TYPES.
  groups: ResourceGroup[];
}
