import { z } from "zod";
import { SEARCH_CHIPS, SEARCH_MAX_LENGTH, type SearchChip } from "@/services/search/query";
import { SEARCH_SECTIONS, type SearchSection } from "@/services/search/schemas";

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

type RawParams = Record<string, string | string[] | undefined>;

// As on the exams page, each parameter stands alone and an unusable one is dropped, so a stale or
// hand-edited link still shows a page. A repeated parameter counts as its first.
function first(raw: RawParams, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseSearchParams(raw: RawParams): SearchParams {
  const type = z.enum(SEARCH_CHIPS).safeParse(first(raw, "type"));
  const show = z.enum(SEARCH_SECTIONS).safeParse(first(raw, "show"));
  const page = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000)).safeParse(first(raw, "page"));
  return {
    q: Array.from((first(raw, "q") ?? "").trim()).slice(0, SEARCH_MAX_LENGTH).join("").trim(),
    type: type.success ? type.data : undefined,
    show: show.success ? show.data : undefined,
    page: page.success ? page.data : 1,
  };
}

// The address for a set of parameters; what is not set (or is the first page) is left out.
export function searchHref(params: Partial<SearchParams>): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type !== undefined) query.set("type", params.type);
  if (params.show !== undefined) query.set("show", params.show);
  if (params.page !== undefined && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/search?${text}` : "/search";
}
