import { z } from "zod";
import { parseYear, type Year } from "@/lib/years";
import { COURSE_CODE_MAX_LENGTH, SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";

export const semesterSchema = z.coerce.number().int().min(SEMESTER_MIN).max(SEMESTER_MAX);
export const courseCodeSchema = z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH);
// A year from the year list (never a stored number); anything else fails validation.
export const yearSchema = z.coerce
  .number()
  .refine((n) => parseYear(n) !== null, "Unknown year")
  .transform((n) => n as Year);
