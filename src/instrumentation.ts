import type { Instrumentation } from "next";
import { buildSentryOptions } from "@/lib/monitoring/options";

// Server-side error tracking. Without SENTRY_DSN nothing is loaded and nothing is sent
// (dev, tests, CI and the build). The SDK is imported only when it is needed.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(buildSentryOptions(dsn, process.env.VERCEL_ENV));
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
};
