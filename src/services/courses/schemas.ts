import { z } from "zod";

export const semesterSchema = z.coerce.number().int().min(3).max(6);
export const courseCodeSchema = z.string().trim().min(1).max(20);
