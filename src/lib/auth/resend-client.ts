export const RESEND_COOLDOWN_SECONDS = 60;
// A longer wait than this (the daily limit) is shown as this many seconds, so the button never counts for hours.
const MAX_SHOWN_SECONDS = 120;

export type ResendResult =
  | { kind: "sent" }
  | { kind: "wait"; seconds: number }
  | { kind: "invalid" }
  | { kind: "error" };

export const RESEND_MESSAGES = {
  sent: "A new link is on its way.",
  wait: "Please wait before asking for another link.",
  invalid: "Enter a valid email address.",
  error: "Could not send a new link. Please try again.",
  network: "Could not reach the server. Check your connection and try again.",
} as const;

// Browser-side call to the resend endpoint; the server answers 202 whether or not an account exists.
export async function requestNewLink(email: string): Promise<ResendResult | "network"> {
  try {
    const response = await fetch("/api/v1/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.status === 202) return { kind: "sent" };
    if (response.status === 429) {
      const body: { retryAfterSeconds?: unknown } | null = await response.json().catch(() => null);
      const seconds = typeof body?.retryAfterSeconds === "number" ? Math.ceil(body.retryAfterSeconds) : RESEND_COOLDOWN_SECONDS;
      return { kind: "wait", seconds: Math.min(Math.max(seconds, 1), MAX_SHOWN_SECONDS) };
    }
    if (response.status === 400) return { kind: "invalid" };
    return { kind: "error" };
  } catch {
    return "network";
  }
}
