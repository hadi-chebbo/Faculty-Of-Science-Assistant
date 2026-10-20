import type { SearchChip } from "@/services/search/query";
import type { SearchSection } from "@/services/search/schemas";

// What the search page reads from the URL.
export interface SearchParams {
  // The words typed, trimmed and cut to the longest length.
  q: string;
  // The chip in the address. Undefined: not given, and the words of the query may select one.
  type?: SearchChip;
  // The section shown in full.
  show?: SearchSection;
  page: number;
}

// The address for a set of parameters; what is not set (or is the first page) is left out. Kept
// apart from params.ts so the search box (a client component) does not pull in the URL parser.
export function searchHref(params: Partial<SearchParams>): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type !== undefined) query.set("type", params.type);
  if (params.show !== undefined) query.set("show", params.show);
  if (params.page !== undefined && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/search?${text}` : "/search";
}
