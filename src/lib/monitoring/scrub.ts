import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Pure helpers applied to every event before it leaves the server, the edge runtime or the browser.
// They remove who hit an error (user, cookies, credentials, IP) and secrets that appear in URLs.
// Type-only import: this file adds nothing to a bundle.

const SECRET_PARAMS = ["token", "ticket"];
const DROPPED_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "true-client-ip",
]);

// Removes the secret query parameters from a URL or a bare query string, keeping everything else
// (also when the URL is relative or cannot be parsed).
export function scrubUrl(url: string): string {
  const hashAt = url.indexOf("#");
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  if (queryAt === -1) return url;
  const query = scrubQueryString(withoutHash.slice(queryAt + 1));
  return withoutHash.slice(0, queryAt) + (query ? `?${query}` : "") + hash;
}

function scrubQueryString(query: string): string {
  const params = new URLSearchParams(query);
  let changed = false;
  for (const name of SECRET_PARAMS) {
    if (params.has(name)) {
      params.delete(name);
      changed = true;
    }
  }
  return changed ? params.toString() : query;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data;
  if (!data) return breadcrumb;
  const scrubbed: Record<string, unknown> = { ...data };
  for (const key of ["url", "from", "to"]) {
    if (typeof scrubbed[key] === "string") scrubbed[key] = scrubUrl(scrubbed[key]);
  }
  return { ...breadcrumb, data: scrubbed };
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  const request = event.request;
  if (request) {
    delete request.cookies;
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (DROPPED_HEADERS.has(name.toLowerCase())) delete request.headers[name];
      }
    }
    if (typeof request.url === "string") request.url = scrubUrl(request.url);
    const query = request.query_string;
    if (typeof query === "string") {
      request.query_string = scrubQueryString(query.replace(/^\?/, ""));
    } else if (Array.isArray(query)) {
      request.query_string = query.filter(([name]) => !SECRET_PARAMS.includes(name));
    } else if (query && typeof query === "object") {
      const kept = { ...query };
      for (const name of SECRET_PARAMS) delete kept[name];
      request.query_string = kept;
    }
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  return event;
}
