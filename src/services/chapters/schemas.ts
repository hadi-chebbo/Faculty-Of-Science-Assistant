import { z } from "zod";
import { CHAPTER_TITLE_MAX_LENGTH } from "@/db/constants";

export const idSchema = z.uuid();

export const chapterInputSchema = z.object({
  title: z.string().trim().min(1).max(CHAPTER_TITLE_MAX_LENGTH),
});

export interface ChapterInput {
  title: string;
}
