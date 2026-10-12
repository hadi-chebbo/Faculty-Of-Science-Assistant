import { z } from "zod";
import { COURSE_CODE_MAX_LENGTH, SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";

export const semesterSchema = z.coerce.number().int().min(SEMESTER_MIN).max(SEMESTER_MAX);
export const courseCodeSchema = z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH);
