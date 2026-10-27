import { foldQuery } from "@/lib/text-fold";
import type { TodoCard } from "@/services/todos/types";

// The board's filter: a text box and one chip at a time. It only decides which loaded cards are
// shown; nothing about it reaches the server, and it is not saved anywhere.
export const ALL_COURSES = "all";
export const NOTES_ONLY = "notes";

export interface BoardFilter {
  text: string;
  // ALL_COURSES, NOTES_ONLY or a course code.
  chip: string;
}

export const NO_FILTER: BoardFilter = { text: "", chip: ALL_COURSES };

export const isFiltering = (filter: BoardFilter) => filter.text.trim() !== "" || filter.chip !== ALL_COURSES;

// The course codes of the cards' available files, sorted.
export function courseCodes(cards: readonly { resource: TodoCard["resource"] }[]): string[] {
  const codes = new Set<string>();
  for (const card of cards) if (card.resource?.available) codes.add(card.resource.courseCode);
  return [...codes].sort((a, b) => a.localeCompare(b));
}

// A chip whose course has no card left is no longer offered; a selected one falls back to All.
export function effectiveChip(chip: string, codes: readonly string[]): string {
  return chip === ALL_COURSES || chip === NOTES_ONLY || codes.includes(chip) ? chip : ALL_COURSES;
}

// Both the text and the chip must match. The text is looked for (ignoring case and accents) in the
// title as shown (`shownTitle`), the note and the course code.
export function matchesFilter(
  card: Pick<TodoCard, "note" | "resource">,
  shownTitle: string,
  filter: BoardFilter,
  codes: readonly string[],
): boolean {
  const chip = effectiveChip(filter.chip, codes);
  if (chip === NOTES_ONLY && card.resource) return false;
  if (chip !== ALL_COURSES && chip !== NOTES_ONLY && !(card.resource?.available && card.resource.courseCode === chip)) return false;
  const wanted = foldQuery(filter.text);
  if (wanted === "") return true;
  const code = card.resource?.available ? card.resource.courseCode : "";
  return foldQuery(`${shownTitle} ${card.note} ${code}`).includes(wanted);
}

// While a filter hides some cards of a column, a student moves a card among the cards they can
// see. The server counts every card, so a place among the visible cards becomes a real index.
//   realIds:      the column's card ids in real order, without the moved card
//   visibleIds:   the visible ids of that column in order, without the moved card
//   visibleIndex: where the card should end up among the visible ones (0 = first)
//   towardsEnd:   the card is moving down its column (it goes just after the visible card above its
//                 new place); otherwise it goes just before the visible card now at that place.
// Either way the card passes its visible neighbour and nothing else it would not have to.
export function realIndexFor(
  realIds: readonly string[],
  visibleIds: readonly string[],
  visibleIndex: number,
  towardsEnd: boolean,
): number {
  if (visibleIds.length === 0) return Math.max(0, Math.min(visibleIndex, realIds.length));
  const at = Math.max(0, Math.min(visibleIndex, visibleIds.length));
  if (towardsEnd && at > 0) return realIds.indexOf(visibleIds[at - 1]) + 1;
  if (at < visibleIds.length) return Math.max(0, realIds.indexOf(visibleIds[at]));
  return realIds.indexOf(visibleIds[visibleIds.length - 1]) + 1;
}
