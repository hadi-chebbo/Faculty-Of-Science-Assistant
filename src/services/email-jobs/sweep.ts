import { QueryTypes } from "sequelize";
import { getDb } from "@/db/models";
import { FAILED_RETENTION_DAYS, SENT_RETENTION_DAYS, SWEEP_LIMIT } from "./constants";
import { processEmailJob } from "./process";
import type { SweepResult } from "./types";

// Processes due pending jobs, oldest first, then deletes old finished jobs (they hold addresses).
export async function processDueEmailJobs({ limit = SWEEP_LIMIT }: { limit?: number } = {}): Promise<SweepResult> {
  const { sequelize } = getDb();
  const due = await sequelize.query<{ id: string }>(
    `SELECT id FROM email_jobs WHERE status = 'pending' AND next_attempt_at <= now()
     ORDER BY next_attempt_at, created_at LIMIT $1`,
    { bind: [limit], type: QueryTypes.SELECT },
  );
  const result: SweepResult = { processed: 0, sent: 0, retried: 0, failed: 0, pruned: 0 };
  for (const { id } of due) {
    const outcome = await processEmailJob(id);
    if (outcome === "skipped") continue; // another runner took it
    result.processed += 1;
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "retry") result.retried += 1;
    else result.failed += 1;
  }
  const [, meta] = await sequelize.query(
    `DELETE FROM email_jobs
     WHERE (status = 'sent' AND sent_at < now() - ($1 * interval '1 day'))
        OR (status = 'failed' AND updated_at < now() - ($2 * interval '1 day'))`,
    { bind: [SENT_RETENTION_DAYS, FAILED_RETENTION_DAYS] },
  );
  result.pruned = (meta as { rowCount?: number }).rowCount ?? 0;
  return result;
}
