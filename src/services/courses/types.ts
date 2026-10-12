import type { ResourceType } from "@/db/constants";
import type { ResourceListItem } from "../resources/types";

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  semester: number;
  resourceCount: number;
}

export interface ResourceGroup {
  type: ResourceType;
  resources: ResourceListItem[];
}

export interface CourseDetail {
  id: string;
  code: string;
  title: string;
  semester: number;
  // Only types that have at least one visible resource, in the order of RESOURCE_TYPES.
  groups: ResourceGroup[];
}
