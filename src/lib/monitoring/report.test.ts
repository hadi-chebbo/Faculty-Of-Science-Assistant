import { afterEach, describe, expect, it, vi } from "vitest";
import { browserErrorQueue } from "./queue";
import { reportError } from "./report";

describe("reportError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as Record<string, unknown>).__universityAssistantErrorQueue;
  });

  function captured(): unknown[] {
    const seen: unknown[] = [];
    browserErrorQueue().ready((error) => seen.push(error));
    return seen;
  }

  it("does nothing without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const seen = captured();
    reportError(new Error("browser"));
    expect(seen).toEqual([]);
  });

  it("reports a browser error", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@example.invalid/1");
    const seen = captured();
    const error = new Error("browser");
    reportError(error);
    expect(seen).toEqual([error]);
  });

  it("skips a server error, which the server already reported", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@example.invalid/1");
    const seen = captured();
    reportError(Object.assign(new Error("An error occurred in the Server Components render."), { digest: "123" }));
    expect(seen).toEqual([]);
  });
});
