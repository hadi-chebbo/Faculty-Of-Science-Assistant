import type { ResourceType } from "@/db/constants";

// What can be marked as done: the counted types and exams. Solutions and other files never can.
export const MARKABLE_TYPES = ["lecture", "notes", "exercise", "exam"] as const satisfies readonly ResourceType[];
// Counted resources make up chapter and course progress; exams are counted apart.
export const COUNTED_TYPES = ["lecture", "notes", "exercise"] as const satisfies readonly ResourceType[];

export function isMarkable(type: ResourceType): boolean {
  return (MARKABLE_TYPES as readonly ResourceType[]).includes(type);
}
