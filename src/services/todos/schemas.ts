import { z } from "zod";
import { TODO_NOTE_MAX_LENGTH, TODO_STATUSES, TODO_TITLE_MAX_LENGTH } from "@/db/constants";

// A note card needs a title; once files can be linked, a card with a file may have none.
export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH),
  note: z.string().max(TODO_NOTE_MAX_LENGTH).default(""),
  status: z.enum(TODO_STATUSES).default("todo"),
});

export type CreateCardInput = z.input<typeof createCardSchema>;
