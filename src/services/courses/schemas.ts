import { z } from "zod";
import { parseYear, type Year } from "@/lib/years";
import { COURSE_CODE_MAX_LENGTH, SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";

export const semesterSchema = z.coerce.number().int().min(SEMESTER_MIN).max(SEMESTER_MAX);
export const courseCodeSchema = z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH);
// A year from the year list (never a stored number); anything else fails validation.
// Accepts what parseYear accepts: a slug ("1", "2", "3", "m1") or a year number 1 to 4. "4" as text is refused.
export const yearSchema = z
  .union([z.string(), z.number()])
  .refine((value) => parseYear(value) !== null, "Unknown year")
  .transform((value) => parseYear(value) as Year);
