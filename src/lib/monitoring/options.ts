import { scrubBreadcrumb, scrubEvent } from "./scrub";

// Options shared by the server, edge and browser SDKs. Errors only: no tracing, replay or
// profiling is configured, and nothing about the visitor is attached.
export function buildSentryOptions(dsn: string, environment: string | undefined) {
  return {
    dsn,
    environment: environment || "development",
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
