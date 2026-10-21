import { browserErrorQueue } from "@/lib/monitoring/queue";

// Browser error tracking, loaded after the page is shown. This file must not import the Sentry
// SDK statically: it would join the first-load bundle that every visitor downloads. Until the SDK
// is ready, tiny listeners keep the first few errors, which are sent once it has loaded.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const queue = browserErrorQueue();
  const onError = (event: ErrorEvent) => queue.push(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => queue.push(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const load = async () => {
    try {
      const [Sentry, { buildSentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/monitoring/options")]);
      Sentry.init(buildSentryOptions(dsn, process.env.NEXT_PUBLIC_VERCEL_ENV));
      // The SDK now has its own handlers; remove ours before flushing so nothing is sent twice.
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      queue.ready((error) => {
        Sentry.captureException(error);
      });
    } catch {
      // Error tracking must never break the page (offline, blocked chunk): give up quietly.
    }
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(() => void load(), { timeout: 4000 });
  else setTimeout(() => void load(), 2000);
}
