import type { Mailer } from "./types";

export type ResendConfig = { apiKey: string; fromEmail: string; fromName: string };

const ENDPOINT = "https://api.resend.com/emails";
export const RESEND_TIMEOUT_MS = 10_000;

// The sender as Resend wants it: a display name and an address. The name is quoted, with quotes and
// backslashes escaped, so nothing in it can end the name early.
export function resendFrom(name: string, email: string): string {
  const quoted = name.replace(/[\\"]/g, (character) => `\\${character}`);
  return `"${quoted}" <${email}>`;
}

// Resend transactional email API, called with fetch (no SDK). Errors name the HTTP status only:
// never the address, the message, the key or the response body.
export function createResendMailer(config: ResendConfig, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send({ to, subject, text, html }) {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: resendFrom(config.fromName, config.fromEmail),
          to: [to],
          subject,
          html,
          text,
        }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Resend send failed with HTTP ${response.status}`);
    },
  };
}
