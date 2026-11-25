import { z } from "zod";
import { createLogMailer } from "./log";
import { createResendMailer, type ResendConfig } from "./resend";
import type { Mailer } from "./types";

// Like storage/config.ts: nothing here runs at import time, so `next build` needs no mail setup.
// A sender is one line: a line break in either value could add a header to the message.
const NO_LINE_BREAK = /^[^\r\n]*$/;

const mailEnvSchema = z.object({
  MAIL_DRIVER: z.enum(["log", "resend"]).optional(),
  MAIL_LOG_FILE: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).regex(NO_LINE_BREAK, "must be one line").optional(),
  MAIL_FROM_NAME: z.string().min(1).regex(NO_LINE_BREAK, "must be one line").default("University Assistant"),
  VERCEL: z.string().optional(),
});

export type MailConfig =
  | { driver: "log"; logFile?: string }
  | { driver: "resend"; resend: ResendConfig };

export function parseMailConfig(source: Record<string, string | undefined>): MailConfig {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([name, value]) => [name, value === "" ? undefined : value]),
  );
  const result = mailEnvSchema.safeParse(cleaned);
  if (!result.success) {
    // Variable names and rules only, never values.
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid mail configuration: ${problems}`);
  }
  const env = result.data;
  const onVercel = Boolean(env.VERCEL);
  if (!env.MAIL_DRIVER && onVercel) {
    throw new Error("Mail is not configured: set MAIL_DRIVER=resend (with RESEND_API_KEY and MAIL_FROM).");
  }
  const driver = env.MAIL_DRIVER ?? "log";
  if (driver === "log") {
    if (onVercel) {
      throw new Error("MAIL_DRIVER=log cannot be used on Vercel: it would write emails into the logs. Use resend.");
    }
    return { driver, ...(env.MAIL_LOG_FILE && { logFile: env.MAIL_LOG_FILE }) };
  }
  const missing = [
    !env.RESEND_API_KEY && "RESEND_API_KEY",
    !env.MAIL_FROM && "MAIL_FROM",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Invalid mail configuration: MAIL_DRIVER=resend needs ${missing.join(", ")}`);
  }
  return {
    driver,
    resend: { apiKey: env.RESEND_API_KEY!, fromEmail: env.MAIL_FROM!, fromName: env.MAIL_FROM_NAME },
  };
}

export function getMailConfig(): MailConfig {
  return parseMailConfig(process.env);
}

// Built per call (cheap, and tests change the environment between runs).
export function getMailer(): Mailer {
  const config = getMailConfig();
  return config.driver === "resend" ? createResendMailer(config.resend) : createLogMailer(config.logFile);
}
