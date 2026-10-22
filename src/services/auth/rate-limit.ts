import { Op, type Transaction } from "sequelize";
import type { RateLimitAction } from "@/db/models/rate-limit-event";
import { getDb } from "@/db/models";
import {
  CONFIRMATION_EMAIL_DAY_SECONDS,
  CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS,
  CONFIRMATION_EMAILS_PER_DAY,
  RATE_LIMIT_RETENTION_SECONDS,
} from "./constants";

const seconds = (n: number) => n * 1000;

async function recentTimes(
  action: RateLimitAction,
  subject: string,
  windowSeconds: number,
  now: Date,
  transaction?: Transaction,
): Promise<Date[]> {
  const rows = await getDb().RateLimitEvent.findAll({
    attributes: ["createdAt"],
    where: { action, subject, createdAt: { [Op.gt]: new Date(now.getTime() - seconds(windowSeconds)) } },
    order: [["createdAt", "ASC"]],
    transaction,
  });
  return rows.map((row) => row.createdAt);
}

// Seconds until the count of events in the window drops below `limit`, or null when it has not
// been reached.
export async function retryAfterIfCountReached(
  action: RateLimitAction,
  subject: string,
  limit: number,
  windowSeconds: number,
  now: Date,
  transaction?: Transaction,
): Promise<number | null> {
  const times = await recentTimes(action, subject, windowSeconds, now, transaction);
  if (times.length < limit) return null;
  const unlockAt = times[times.length - limit].getTime() + seconds(windowSeconds);
  return Math.max(1, Math.ceil((unlockAt - now.getTime()) / 1000));
}

// Seconds until another confirmation-type email may go to this address: at most one a minute and
// five a day. Null when allowed now.
export async function confirmationEmailRetryAfter(
  email: string,
  now: Date,
  transaction?: Transaction,
): Promise<number | null> {
  const times = await recentTimes("confirmation-email", email, CONFIRMATION_EMAIL_DAY_SECONDS, now, transaction);
  const waits: number[] = [];
  const last = times[times.length - 1];
  if (last) {
    const unlockAt = last.getTime() + seconds(CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS);
    if (unlockAt > now.getTime()) waits.push(unlockAt - now.getTime());
  }
  if (times.length >= CONFIRMATION_EMAILS_PER_DAY) {
    const unlockAt = times[times.length - CONFIRMATION_EMAILS_PER_DAY].getTime() + seconds(CONFIRMATION_EMAIL_DAY_SECONDS);
    waits.push(unlockAt - now.getTime());
  }
  if (waits.length === 0) return null;
  return Math.max(1, Math.ceil(Math.max(...waits) / 1000));
}

export async function recordRateLimitEvent(
  action: RateLimitAction,
  subject: string,
  now: Date,
  transaction?: Transaction,
): Promise<void> {
  const { RateLimitEvent } = getDb();
  await RateLimitEvent.create({ action, subject, createdAt: now }, { transaction });
  // Opportunistic cleanup so the table cannot grow without bound.
  await RateLimitEvent.destroy({
    where: { createdAt: { [Op.lt]: new Date(now.getTime() - seconds(RATE_LIMIT_RETENTION_SECONDS)) } },
    transaction,
  });
}
