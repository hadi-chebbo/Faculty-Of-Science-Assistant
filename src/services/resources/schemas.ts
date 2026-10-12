import { z } from "zod";
import {
  ACADEMIC_YEAR_MAX,
  ACADEMIC_YEAR_MIN,
  COURSE_CODE_MAX_LENGTH,
  EXAM_SESSIONS,
  LANGUAGES,
  RESOURCE_TYPES,
  SEMESTER_MAX,
  SEMESTER_MIN,
} from "@/db/constants";
import type { ExamSession, Language, ResourceType } from "@/db/constants";
import { blankToUndefined } from "../validation";

export const RESOURCE_PAGE_SIZE_DEFAULT = 50;
export const RESOURCE_PAGE_SIZE_MAX = 100;

export const idSchema = z.uuid();

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

// Accepts raw search params as well as typed values: numbers may arrive as strings and a blank
// string means "no filter".
export const resourceFiltersSchema = z.object({
  courseCode: optional(z.string().trim().max(COURSE_CODE_MAX_LENGTH)),
  semester: optional(z.coerce.number().int().min(SEMESTER_MIN).max(SEMESTER_MAX)),
  type: optional(z.enum(RESOURCE_TYPES)),
  academicYearStart: optional(z.coerce.number().int().min(ACADEMIC_YEAR_MIN).max(ACADEMIC_YEAR_MAX)),
  examSession: optional(z.enum(EXAM_SESSIONS)),
  language: optional(z.enum(LANGUAGES)),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
  pageSize: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).max(RESOURCE_PAGE_SIZE_MAX).default(RESOURCE_PAGE_SIZE_DEFAULT),
  ),
});

// What a typed caller passes. Everything is optional; the schema fills in the paging defaults.
export interface ResourceFilters {
  courseCode?: string;
  // The semester of the resource's course.
  semester?: number;
  type?: ResourceType;
  academicYearStart?: number;
  examSession?: ExamSession;
  language?: Language;
  page?: number;
  pageSize?: number;
}
