import type { Transaction } from "sequelize";
import { z } from "zod";
import { getDb } from "@/db/models";
import { parseInput } from "../validation";

const enqueueSchema = z.object({
  kind: z.string().min(1).max(100),
  to: z.string().trim().toLowerCase().min(1).max(254),
  payload: z.record(z.string(), z.unknown()).default({}),
});

// RULE: the payload never holds a secret (no token, no password). Handlers create secrets when the
// email is sent. The transaction is required so the job commits (or rolls back) with the caller's
// own change, for example the new user. Returns the job id; send it after the commit with
// sendEmailJobAfterResponse.
export async function enqueueEmailJob(
  input: { kind: string; to: string; payload?: Record<string, unknown> },
  transaction: Transaction,
): Promise<string> {
  const data = parseInput(enqueueSchema, input);
  const job = await getDb().EmailJob.create(
    { kind: data.kind, toEmail: data.to, payload: data.payload },
    { transaction },
  );
  return job.id;
}
