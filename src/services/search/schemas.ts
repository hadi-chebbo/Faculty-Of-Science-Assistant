import { z } from "zod";
import { SEARCH_CHIPS, SEARCH_MAX_LENGTH } from "./query";

export const SEARCH_SECTIONS = ["courses", "chapters", "files"] as const;
export type SearchSection = (typeof SEARCH_SECTIONS)[number];

// The query is checked for its longest length here; a query that is too short is not an error but
// the "start typing" state (see searchCatalog).
export const searchInputSchema = z.object({
  query: z.string().trim().max(SEARCH_MAX_LENGTH),
  // The chip the visitor chose. Left out, the words of the query may choose one.
  type: z.enum(SEARCH_CHIPS).optional(),
  // Which section is shown in full, 20 to a page.
  show: z.enum(SEARCH_SECTIONS).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
});

export interface SearchInput {
  query: string;
  type?: (typeof SEARCH_CHIPS)[number];
  show?: SearchSection;
  page?: number;
}
