import { browserErrorQueue } from "./queue";

// For error boundaries: reports a rendering error to Sentry once the browser SDK has loaded.
// A no-op when no DSN is configured, so dev, tests and CI send nothing.
// An error with a `digest` was thrown on the server: the server already reported it (with its real
// message and stack), and the browser only sees a redacted copy, so it is not sent twice.
export function reportError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (typeof error === "object" && error !== null && typeof (error as { digest?: unknown }).digest === "string") return;
  browserErrorQueue().push(error);
}
