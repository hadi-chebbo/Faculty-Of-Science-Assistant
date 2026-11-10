import { z } from "zod";
import { LECTURER_NAME_MAX_LENGTH } from "@/db/constants";

// "  Dr.   Ali  Ghorayeb " -> "Dr. Ali Ghorayeb": trimmed, inner whitespace collapsed.
export function normaliseLecturerName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export const lecturerInputSchema = z.object({
  name: z.string().transform(normaliseLecturerName).pipe(z.string().min(1).max(LECTURER_NAME_MAX_LENGTH)),
});

export type LecturerInput = z.input<typeof lecturerInputSchema>;

// A lecturer's slug as it may appear in an address (`?lecturer=`): what `lecturerSlug` makes.
export const lecturerSlugSchema = z.string().trim().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
