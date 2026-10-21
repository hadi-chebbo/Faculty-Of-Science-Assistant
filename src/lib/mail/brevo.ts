import type { Mailer } from "./types";

export type BrevoConfig = { apiKey: string; fromEmail: string; fromName: string };

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
export const BREVO_TIMEOUT_MS = 10_000;

// Brevo transactional email API, called with fetch (no SDK). Errors name the HTTP status only:
// never the address, the message or the response body.
export function createBrevoMailer(config: BrevoConfig, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send({ to, subject, text, html }) {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: config.fromEmail, name: config.fromName },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Brevo send failed with HTTP ${response.status}`);
    },
  };
}
