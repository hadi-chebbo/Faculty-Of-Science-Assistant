import { hash } from "@node-rs/argon2";
import { Op, UniqueConstraintError, type Transaction } from "sequelize";
import { getDb } from "@/db/models";
import { InvalidConfirmationTokenError, TooManyAttemptsError } from "../errors";
import { enqueueEmailJob } from "../email-jobs/enqueue";
import { parseInput } from "../validation";
import { SIGN_UP_LIMIT_PER_IP, SIGN_UP_WINDOW_SECONDS, UNCONFIRMED_ACCOUNT_TTL_SECONDS } from "./constants";
import { confirmationEmailRetryAfter, recordRateLimitEvent, retryAfterIfCountReached } from "./rate-limit";
import { rawTokenSchema, resendConfirmationSchema, signUpSchema } from "./schemas";
import { hashToken } from "./token-hash";

export const CONFIRM_EMAIL_KIND = "confirm-email";
export const ALREADY_REGISTERED_KIND = "already-registered";

// Both a new and an existing address answer the same way, so the result says nothing about
// whether the account existed. The caller sends the job (if any) after the commit.
export type SignUpResult = { jobId: string | null };

// The payload holds the user id (never a secret) so the handler can tell if the account is gone.
// Enqueues one confirmation-type email unless the address already got one a minute ago or five
// today (then it is skipped silently). Counted for the address, whether or not it has an account.
async function enqueueLimited(
  email: string,
  kind: string,
  payload: Record<string, unknown>,
  now: Date,
  transaction: Transaction,
): Promise<string | null> {
  if ((await confirmationEmailRetryAfter(email, now, transaction)) !== null) return null;
  await recordRateLimitEvent("confirmation-email", email, now, transaction);
  return enqueueEmailJob({ kind, to: email, payload }, transaction);
}

// Creates a student account that cannot sign in until the email is confirmed.
// - New address: create the account and send a confirmation email.
// - Unconfirmed account: "last sign-up wins". The password and name are replaced and old links stop
//   working, so a student who forgot the password before confirming can simply sign up again.
// - Blocked account: nothing changes and nothing is sent.
// - Confirmed account: nothing changes; the address gets an "already have an account" email.
// The password is always hashed, so timing does not tell the cases apart.
export async function signUp(
  input: { email: string; password: string; name?: string | null; ip: string },
  now: Date = new Date(),
): Promise<SignUpResult> {
  const { email, password, name, ip } = parseInput(signUpSchema, input);
  const { sequelize } = getDb();

  const retryAfter = await retryAfterIfCountReached("sign-up", ip, SIGN_UP_LIMIT_PER_IP, SIGN_UP_WINDOW_SECONDS, now);
  if (retryAfter !== null) throw new TooManyAttemptsError(retryAfter);
  await recordRateLimitEvent("sign-up", ip, now);

  const passwordHash = await hash(password); // Argon2id, library defaults

  const run = () =>
    sequelize.transaction(async (transaction): Promise<SignUpResult> => {
      const { User, EmailConfirmation } = getDb();
      const existing = await User.findOne({ where: { email }, lock: transaction.LOCK.UPDATE, transaction });

      if (!existing) {
        const user = await User.create(
          { email, name, passwordHash, role: "student", emailConfirmedAt: null, createdAt: now, updatedAt: now },
          { transaction },
        );
        return { jobId: await enqueueLimited(email, CONFIRM_EMAIL_KIND, { userId: user.id }, now, transaction) };
      }

      // A blocked account keeps its row and the address stays taken: nothing changes and nothing is sent.
      if (existing.blockedAt) return { jobId: null };

      if (existing.emailConfirmedAt) {
        return { jobId: await enqueueLimited(email, ALREADY_REGISTERED_KIND, {}, now, transaction) };
      }

      await User.update({ passwordHash, name, updatedAt: now }, { where: { id: existing.id }, transaction });
      const jobId = await enqueueLimited(email, CONFIRM_EMAIL_KIND, { userId: existing.id }, now, transaction);
      if (jobId) {
        // Only when a new link goes out: otherwise the student keeps the one they have.
        await EmailConfirmation.destroy({ where: { userId: existing.id, usedAt: null }, transaction });
      }
      return { jobId };
    });

  try {
    return await run();
  } catch (error) {
    // Two sign-ups for the same new address at once: the second finds the first's account.
    if (error instanceof UniqueConstraintError) return run();
    throw error;
  }
}

// Marks the email confirmed. The token is single use and valid for 24 hours; every failure is the
// same error. It confirms only: no session is created.
export async function confirmEmail(rawToken: string, now: Date = new Date()): Promise<void> {
  const parsed = rawTokenSchema.safeParse(rawToken);
  if (!parsed.success) throw new InvalidConfirmationTokenError();
  const tokenHash = hashToken(parsed.data);
  const { sequelize, EmailConfirmation, User } = getDb();

  const ok = await sequelize.transaction(async (transaction) => {
    const row = await EmailConfirmation.findOne({ where: { tokenHash }, lock: transaction.LOCK.UPDATE, transaction });
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) return false;
    const user = await User.findByPk(row.userId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!user) return false;
    await row.update({ usedAt: now }, { transaction });
    if (!user.emailConfirmedAt) await user.update({ emailConfirmedAt: now, updatedAt: now }, { transaction });
    return true;
  });
  if (!ok) throw new InvalidConfirmationTokenError();
}

// Sends a new confirmation link to an unconfirmed account. The per-address limit counts any
// address, existing or not, so a refusal reveals nothing; the answer is the same either way.
export async function resendConfirmation(input: { email: string }, now: Date = new Date()): Promise<SignUpResult> {
  const { email } = parseInput(resendConfirmationSchema, input);
  const { sequelize, User } = getDb();

  return sequelize.transaction(async (transaction) => {
    const retryAfter = await confirmationEmailRetryAfter(email, now, transaction);
    if (retryAfter !== null) throw new TooManyAttemptsError(retryAfter);
    await recordRateLimitEvent("confirmation-email", email, now, transaction);

    const user = await User.findOne({ where: { email }, lock: transaction.LOCK.UPDATE, transaction });
    if (!user || user.emailConfirmedAt || user.blockedAt) return { jobId: null };

    const jobId = await enqueueEmailJob({ kind: CONFIRM_EMAIL_KIND, to: email, payload: { userId: user.id } }, transaction);
    return { jobId };
  });
}

// Deletes accounts that were never confirmed within 7 days. Admins, confirmed and blocked accounts stay.
export async function deleteUnconfirmedAccounts(now: Date = new Date()): Promise<number> {
  const { User } = getDb();
  return User.destroy({
    where: {
      emailConfirmedAt: null,
      blockedAt: null,
      role: "student",
      createdAt: { [Op.lt]: new Date(now.getTime() - UNCONFIRMED_ACCOUNT_TTL_SECONDS * 1000) },
    },
  });
}
