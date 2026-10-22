import { randomBytes } from "node:crypto";
import { getDb } from "@/db/models";
import { getAppUrl } from "@/lib/app-url";
import { registerEmailHandler } from "../email-jobs/registry";
import type { EmailContent, EmailHandler, EmailJobView } from "../email-jobs/types";
import { CONFIRMATION_TOKEN_BYTES, CONFIRMATION_TOKEN_TTL_SECONDS } from "./constants";
import { hashToken } from "./token-hash";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Minimal inline-styled layout. `paragraphs` are plain text and are escaped here.
function page(paragraphs: string[], button: { label: string; href: string }): string {
  const body = paragraphs
    .map((text) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#41454f">${escapeHtml(text)}</p>`)
    .join("");
  const href = escapeHtml(button.href);
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px">` +
    body +
    `<p style="margin:0 0 16px"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#3e4eb8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px">${escapeHtml(button.label)}</a></p>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#575757">Or copy this link into your browser:<br>${href}</p>` +
    `<p style="margin:0;font-size:14px;color:#575757">University Assistant</p>` +
    `</div>`
  );
}

// Mints the token now (not at sign-up), so the raw value exists only in this email. The job
// payload and the database hold the user id and the token's hash respectively.
// `now` is injectable for tests; the sender passes only the job.
export const confirmEmailHandler = async (job: EmailJobView, now: Date = new Date()): Promise<EmailContent | null> => {
  const userId = typeof job.payload.userId === "string" ? job.payload.userId : null;
  if (!userId) return null;
  const { User, EmailConfirmation } = getDb();
  const user = await User.findByPk(userId);
  if (!user || user.emailConfirmedAt) return null; // deleted or already confirmed: nothing to send

  const token = randomBytes(CONFIRMATION_TOKEN_BYTES).toString("base64url");
  await EmailConfirmation.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + CONFIRMATION_TOKEN_TTL_SECONDS * 1000),
    createdAt: now,
  });

  const link = `${getAppUrl()}/confirm-email?token=${token}`;
  const lines = [
    "Welcome to University Assistant.",
    "Please confirm your email address to finish creating your account. The link works for 24 hours and only once.",
  ];
  const ignore = "If you did not sign up, you can ignore this email and no account will be kept.";
  return {
    subject: "Confirm your email",
    text: `${lines.join("\n\n")}\n\nConfirm your email: ${link}\n\n${ignore}\n`,
    html: page([...lines, ignore], { label: "Confirm your email", href: link }),
  };
};

export const alreadyRegisteredHandler: EmailHandler = (): EmailContent => {
  const link = `${getAppUrl()}/sign-in`;
  const lines = [
    "Someone, probably you, tried to sign up to University Assistant with this email address.",
    "You already have an account, so there is nothing to confirm. You can sign in instead.",
  ];
  const ignore = "If it was not you, you can ignore this email. Your account has not been changed.";
  return {
    subject: "You already have an account",
    text: `${lines.join("\n\n")}\n\nSign in: ${link}\n\n${ignore}\n`,
    html: page([...lines, ignore], { label: "Sign in", href: link }),
  };
};

export function registerAuthEmailHandlers(): void {
  registerEmailHandler("confirm-email", confirmEmailHandler);
  registerEmailHandler("already-registered", alreadyRegisteredHandler);
}
