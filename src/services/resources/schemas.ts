import { z } from "zod";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TYPES } from "@/db/constants";

export const idSchema = z.uuid();

export const resourceFiltersSchema = z.object({
  courseCode: z.string().trim().min(1).max(20).optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  academicYearStart: z.coerce.number().int().min(2000).max(2100).optional(),
  examSession: z.enum(EXAM_SESSIONS).optional(),
  language: z.enum(LANGUAGES).optional(),
});

export type ResourceFilters = z.infer<typeof resourceFiltersSchema>;
