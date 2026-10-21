import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubUrl } from "./scrub";

const event = (extra: Partial<ErrorEvent>): ErrorEvent => ({ type: undefined, ...extra }) as ErrorEvent;

describe("scrubUrl", () => {
  it("removes token and ticket but keeps other parameters and the hash", () => {
    expect(scrubUrl("https://x.test/a?page=2&token=abc&ticket=def&q=x#top")).toBe("https://x.test/a?page=2&q=x#top");
  });
  it("drops the question mark when nothing is left", () => {
    expect(scrubUrl("/files/x?token=abc")).toBe("/files/x");
  });
  it("leaves a url without a query, or without secrets, untouched", () => {
    expect(scrubUrl("/courses/DEMO301")).toBe("/courses/DEMO301");
    expect(scrubUrl("/search?q=a%20b&type=exam")).toBe("/search?q=a%20b&type=exam");
  });
});

describe("scrubEvent", () => {
  it("removes the user", () => {
    const result = scrubEvent(event({ user: { id: "1", email: "a@b.c", ip_address: "1.2.3.4" } }));
    expect(result.user).toBeUndefined();
  });

  it("removes cookies and credential or address headers, in any case, and keeps the others", () => {
    const result = scrubEvent(
      event({
        request: {
          cookies: { session: "s" },
          headers: {
            Cookie: "a=b",
            Authorization: "Bearer x",
            "X-Forwarded-For": "1.2.3.4",
            "x-real-ip": "1.2.3.4",
            "Set-Cookie": "a=b",
            "user-agent": "Mozilla",
            accept: "text/html",
          },
        },
      }),
    );
    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.headers).toEqual({ "user-agent": "Mozilla", accept: "text/html" });
  });

  it("removes secret parameters from the url and the query string in every shape", () => {
    const url = scrubEvent(event({ request: { url: "https://x.test/f?token=1&a=2", query_string: "token=1&a=2&ticket=3" } }));
    expect(url.request?.url).toBe("https://x.test/f?a=2");
    expect(url.request?.query_string).toBe("a=2");

    const object = scrubEvent(event({ request: { query_string: { token: "1", a: "2" } } }));
    expect(object.request?.query_string).toEqual({ a: "2" });

    const pairs = scrubEvent(event({ request: { query_string: [["ticket", "1"], ["a", "2"]] } }));
    expect(pairs.request?.query_string).toEqual([["a", "2"]]);
  });

  it("scrubs breadcrumbs and keeps the route, tags and stack", () => {
    const result = scrubEvent(
      event({
        transaction: "/courses/[code]",
        tags: { runtime: "node" },
        exception: { values: [{ type: "Error", value: "boom", stacktrace: { frames: [{ filename: "a.js" }] } }] },
        breadcrumbs: [{ category: "fetch", data: { url: "/api/x?ticket=1&b=2", method: "GET" } }],
      }),
    );
    expect(result.breadcrumbs?.[0].data).toEqual({ url: "/api/x?b=2", method: "GET" });
    expect(result.transaction).toBe("/courses/[code]");
    expect(result.tags).toEqual({ runtime: "node" });
    expect(result.exception?.values?.[0].stacktrace?.frames).toEqual([{ filename: "a.js" }]);
  });

  it("handles an event with no request or breadcrumbs", () => {
    expect(scrubEvent(event({ message: "hi" })).message).toBe("hi");
  });
});

describe("scrubBreadcrumb", () => {
  it("cleans url, from and to, and leaves a breadcrumb without data alone", () => {
    const crumb: Breadcrumb = { category: "navigation", data: { from: "/a?token=1", to: "/b?x=1&ticket=2" } };
    expect(scrubBreadcrumb(crumb).data).toEqual({ from: "/a", to: "/b?x=1" });
    expect(scrubBreadcrumb({ message: "m" })).toEqual({ message: "m" });
  });
});
