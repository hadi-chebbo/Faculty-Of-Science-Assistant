// Holds the first few browser errors until the Sentry SDK (loaded when the browser is idle) is
// ready, then hands them over once. Kept on `globalThis` so `instrumentation-client` and the
// error boundaries share one queue whichever chunk they were bundled into.

export const MAX_QUEUED_ERRORS = 10;

export type ErrorQueue = {
  push(error: unknown): void;
  // Starts sending: flushes what is queued, and every later push goes straight to `capture`.
  ready(capture: (error: unknown) => void): void;
};

export function createErrorQueue(max: number = MAX_QUEUED_ERRORS): ErrorQueue {
  const waiting: unknown[] = [];
  let capture: ((error: unknown) => void) | null = null;
  return {
    push(error) {
      if (capture) capture(error);
      else if (waiting.length < max) waiting.push(error);
    },
    ready(next) {
      if (capture) return;
      capture = next;
      for (const error of waiting.splice(0)) next(error);
    },
  };
}

const KEY = "__universityAssistantErrorQueue";

export function browserErrorQueue(): ErrorQueue {
  const holder = globalThis as unknown as Record<string, ErrorQueue | undefined>;
  return (holder[KEY] ??= createErrorQueue());
}
