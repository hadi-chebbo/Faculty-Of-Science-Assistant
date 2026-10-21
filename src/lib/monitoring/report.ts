import { browserErrorQueue } from "./queue";

// For error boundaries: reports a rendering error to Sentry once the browser SDK has loaded.
// A no-op when no DSN is configured, so dev, tests and CI send nothing.
export function reportError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  browserErrorQueue().push(error);
}
