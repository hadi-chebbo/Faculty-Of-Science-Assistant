import { z } from "zod";
import { TODO_NOTE_MAX_LENGTH, TODO_STATUSES, TODO_TITLE_MAX_LENGTH } from "@/db/constants";

// A note card needs a title; a card with a linked file may have none.
export const createCardSchema = z
  .object({
    title: z.string().trim().max(TODO_TITLE_MAX_LENGTH).default(""),
    note: z.string().max(TODO_NOTE_MAX_LENGTH).default(""),
    status: z.enum(TODO_STATUSES).default("todo"),
    // Not checked as a UUID here: a malformed id is "not found", like an unknown one.
    resourceId: z.string().optional(),
  })
  .refine((card) => card.title !== "" || card.resourceId !== undefined, { path: ["title"], message: "A card needs a title" });

export type CreateCardInput = z.input<typeof createCardSchema>;

// Every field is optional, so the card view can send only what changed. `resourceId: null` removes
// the link. Whether the title may be empty depends on the card (a linked file can stand in), so the
// service checks that.
export const updateCardSchema = z.object({
  title: z.string().trim().max(TODO_TITLE_MAX_LENGTH).optional(),
  note: z.string().max(TODO_NOTE_MAX_LENGTH).optional(),
  resourceId: z.string().nullable().optional(),
});

export type UpdateCardInput = z.input<typeof updateCardSchema>;

export const cardIdSchema = z.uuid();

// `index` is the place in the target column, 0 = top; one past the end is clamped by the service.
export const moveCardSchema = z.object({
  status: z.enum(TODO_STATUSES),
  index: z.number().int().min(0),
});

export type MoveCardInput = z.input<typeof moveCardSchema>;
