import { QueryTypes } from "sequelize";
import { getDb } from "@/db/models";
import { getMailer } from "@/lib/mail/config";
import { BACKOFF_MINUTES, CLAIM_LEASE_MINUTES, MAX_ATTEMPTS } from "./constants";
import { getEmailHandler } from "./registry";
import type { EmailJobOutcome, EmailJobView } from "./types";

type ClaimedRow = { id: string; kind: string; to_email: string; payload: Record<string, unknown>; attempts: number };

// A short reason for last_error: no address (and handlers and drivers never put a token in an error).
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[address]").slice(0, 500);
}

// Claims the job with one atomic UPDATE that also pushes next_attempt_at forward (a lease), so two
// runners never send the same job and a runner that dies mid-send is retried after the lease. Then it builds and
// sends the message. A failure keeps the job pending with a later next_attempt_at, until the
// MAX_ATTEMPTS-th failure marks it failed.
export async function processEmailJob(id: string): Promise<EmailJobOutcome> {
  const { sequelize } = getDb();
  const [claimed] = await sequelize.query<ClaimedRow>(
    `UPDATE email_jobs SET attempts = attempts + 1, next_attempt_at = now() + ($2 * interval '1 minute'), updated_at = now()
     WHERE id = $1 AND status = 'pending' AND next_attempt_at <= now()
     RETURNING id, kind, to_email, payload, attempts`,
    { bind: [id, CLAIM_LEASE_MINUTES], type: QueryTypes.SELECT },
  );
  if (!claimed) return "skipped";
  const job: EmailJobView = {
    id: claimed.id,
    kind: claimed.kind,
    toEmail: claimed.to_email,
    payload: claimed.payload,
    attempts: claimed.attempts,
  };

  const fail = async (reason: string, final: boolean): Promise<EmailJobOutcome> => {
    if (final) {
      await sequelize.query(
        "UPDATE email_jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1",
        { bind: [id, reason] },
      );
      return "failed";
    }
    const minutes = BACKOFF_MINUTES[job.attempts - 1];
    await sequelize.query(
      `UPDATE email_jobs SET last_error = $2, next_attempt_at = now() + ($3 * interval '1 minute'), updated_at = now()
       WHERE id = $1`,
      { bind: [id, reason, minutes] },
    );
    return "retry";
  };

  const handler = getEmailHandler(job.kind);
  if (!handler) return fail("unknown kind", true);

  try {
    // The mailer first: with mail unconfigured nothing is built (no token is minted for nothing).
    const mailer = getMailer();
    const content = await handler(job);
    await mailer.send({ to: job.toEmail, ...content });
  } catch (error) {
    return fail(reasonOf(error), job.attempts >= MAX_ATTEMPTS);
  }
  await sequelize.query(
    "UPDATE email_jobs SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now() WHERE id = $1",
    { bind: [id] },
  );
  return "sent";
}
