import { z } from "zod";
import {
  ACADEMIC_YEAR_MAX,
  ACADEMIC_YEAR_MIN,
  COURSE_CODE_MAX_LENGTH,
  EXAM_SESSIONS,
  LANGUAGES,
  RESOURCE_TITLE_MAX_LENGTH,
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

// Blank and null both mean "not given" for the optional write fields.
const blankOrNullToUndefined = (value: unknown) => (value === null ? undefined : blankToUndefined(value));
const given = <T extends z.ZodType>(schema: T) => z.preprocess(blankOrNullToUndefined, schema.optional());

const httpsUrl = z
  .string()
  .trim()
  .refine((value) => value.startsWith("https://") && URL.canParse(value));

// What an admin may set on a resource; the same for create and update. Rules that need the
// database (course, solution target, source) are checked by the write service.
export const resourceInputSchema = z
  .object({
    courseId: idSchema,
    type: z.enum(RESOURCE_TYPES),
    title: z.string().trim().min(1).max(RESOURCE_TITLE_MAX_LENGTH),
    description: given(z.string().trim()).transform((value) => value ?? null),
    academicYearStart: given(z.coerce.number().int().min(ACADEMIC_YEAR_MIN).max(ACADEMIC_YEAR_MAX)).transform(
      (value) => value ?? null,
    ),
    examSession: given(z.enum(EXAM_SESSIONS)).transform((value) => value ?? null),
    language: z.preprocess(blankOrNullToUndefined, z.enum(LANGUAGES).default("en")),
    externalUrl: given(httpsUrl).transform((value) => value ?? null),
    solutionOfId: given(idSchema).transform((value) => value ?? null),
    chapterId: given(idSchema).transform((value) => value ?? null),
    isPublished: z.boolean().default(false),
  })
  .superRefine((input, ctx) => {
    if (input.type === "exam" && input.examSession === null) {
      ctx.addIssue({ code: "custom", path: ["examSession"] });
    }
    if (input.type !== "exam" && input.examSession !== null) {
      ctx.addIssue({ code: "custom", path: ["examSession"] });
    }
    if (input.type === "exam" && input.chapterId !== null) {
      ctx.addIssue({ code: "custom", path: ["chapterId"] });
    }
    if (input.type !== "solution" && input.solutionOfId !== null) {
      ctx.addIssue({ code: "custom", path: ["solutionOfId"] });
    }
  });

export type ResourceInputData = z.output<typeof resourceInputSchema>;

// What a typed caller passes. Optional fields may be left out, null or blank.
export interface ResourceInput {
  courseId: string;
  type: ResourceType;
  title: string;
  description?: string | null;
  academicYearStart?: number | null;
  examSession?: ExamSession | null;
  language?: Language;
  externalUrl?: string | null;
  solutionOfId?: string | null;
  chapterId?: string | null;
  isPublished?: boolean;
}
