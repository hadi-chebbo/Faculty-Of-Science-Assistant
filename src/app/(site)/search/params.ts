import { z } from "zod";
import { SEARCH_CHIPS, clipQuery } from "@/services/search/query";
import { SEARCH_SECTIONS } from "@/services/search/schemas";
import type { SearchParams } from "./href";

export { searchHref, type SearchParams } from "./href";

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
    // The same cut the service counts by, so what passes here is never refused there.
    q: clipQuery(first(raw, "q") ?? ""),
    type: type.success ? type.data : undefined,
    show: show.success ? show.data : undefined,
    page: page.success ? page.data : 1,
  };
}
