import { createHash, randomBytes, randomUUID } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { Op, type Transaction } from "sequelize";
import { getDb } from "@/db/models";
import { InvalidCredentialsError, InvalidSessionError, TooManyAttemptsError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { signAccessToken } from "./access-token";
import {
  ATTEMPT_RETENTION_SECONDS,
  ATTEMPT_WINDOW_SECONDS,
  MAX_FAILED_ATTEMPTS_PER_EMAIL,
  MAX_FAILED_ATTEMPTS_PER_IP,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./constants";
import { rawTokenSchema, signInSchema } from "./schemas";
import type { AccountSummary, Session, SessionTokens } from "./types";

export { verifyAccessToken } from "./access-token";

// A real Argon2id hash (library defaults) of a throwaway password. Unknown emails are verified
// against it so a failed sign-in costs the same time whether or not the account exists.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Eh2E0gdAF9xip2/2qdpIwQ$RO6HuLfTYISQ1eV6bRkkZdJUTb7E9VNPbmScvDIqZhw";

const seconds = (n: number) => n * 1000;

// The database only ever sees this hash; the raw token lives in the cookie alone.
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function toAccountSummary(user: { id: string; email: string; name: string | null; role: AccountSummary["role"] }): AccountSummary {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function passwordMatches(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false; // a malformed stored hash is a failed sign-in, not a crash
  }
}

// Seconds until enough old failures fall out of the window for the count to drop below `limit`,
// or null when the limit has not been reached.
async function retryAfterIfLimited(
  where: { email: string } | { ip: string },
  limit: number,
  now: Date,
): Promise<number | null> {
  const { FailedSignIn } = getDb();
  const windowStart = new Date(now.getTime() - seconds(ATTEMPT_WINDOW_SECONDS));
  const rows = await FailedSignIn.findAll({
    attributes: ["createdAt"],
    where: { ...where, createdAt: { [Op.gt]: windowStart } },
    order: [["createdAt", "ASC"]],
  });
  if (rows.length < limit) return null;
  const decisive = rows[rows.length - limit];
  const unlockAt = decisive.createdAt.getTime() + seconds(ATTEMPT_WINDOW_SECONDS);
  return Math.max(1, Math.ceil((unlockAt - now.getTime()) / 1000));
}

async function recordFailure(email: string, ip: string, now: Date): Promise<void> {
  const { FailedSignIn } = getDb();
  await FailedSignIn.create({ email, ip, createdAt: now });
  // Opportunistic cleanup so the table cannot grow without bound.
  await FailedSignIn.destroy({
    where: { createdAt: { [Op.lt]: new Date(now.getTime() - seconds(ATTEMPT_RETENTION_SECONDS)) } },
  });
}

// Creates and stores a refresh token in `familyId`, and signs an access token for `user`.
async function issueTokens(
  user: { id: string; role: AccountSummary["role"] },
  familyId: string,
  now: Date,
  transaction?: Transaction,
): Promise<SessionTokens> {
  const { RefreshToken } = getDb();
  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  const refreshTokenExpiresAt = new Date(now.getTime() + seconds(REFRESH_TOKEN_TTL_SECONDS));
  await RefreshToken.create(
    { userId: user.id, tokenHash: hashToken(refreshToken), familyId, expiresAt: refreshTokenExpiresAt, createdAt: now },
    { transaction },
  );
  const access = await signAccessToken(user, now);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

// Checks the rate limits first, then the password. Every failure looks the same to the caller
// (InvalidCredentialsError), except being locked out (TooManyAttemptsError), which is decided
// before any password work and so also protects the correct password while locked.
// Limits are checked then counted without a lock, so a burst of parallel guesses can overshoot by
// a few attempts; that is acceptable for this threat model.
export async function signIn(
  input: { email: string; password: string; ip: string },
  now: Date = new Date(),
): Promise<Session> {
  const { email, password, ip } = parseInput(signInSchema, input);
  const { User, FailedSignIn } = getDb();

  const retryAfter = [
    await retryAfterIfLimited({ email }, MAX_FAILED_ATTEMPTS_PER_EMAIL, now),
    await retryAfterIfLimited({ ip }, MAX_FAILED_ATTEMPTS_PER_IP, now),
  ].filter((value): value is number => value !== null);
  if (retryAfter.length > 0) throw new TooManyAttemptsError(Math.max(...retryAfter));

  const user = await User.scope("withPasswordHash").findOne({ where: { email } });
  const ok = await passwordMatches(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
  if (!user || !ok) {
    await recordFailure(email, ip, now);
    throw new InvalidCredentialsError();
  }

  await FailedSignIn.destroy({ where: { email } });
  const tokens = await issueTokens(user, randomUUID(), now);
  return { user: toAccountSummary(user), ...tokens };
}

type RefreshOutcome =
  | { kind: "ok"; session: Session }
  | { kind: "invalid"; revokeFamily?: string };

// Rotates the refresh token: the presented one is revoked and a new one issued in the same family.
// The row is locked, so of two concurrent refreshes with the same token only the first succeeds;
// the second finds it revoked, which counts as reuse and revokes the whole family. The same
// happens for a replayed token, which may mean it was stolen.
export async function refreshSession(rawRefreshToken: string, now: Date = new Date()): Promise<Session> {
  const parsed = rawTokenSchema.safeParse(rawRefreshToken);
  if (!parsed.success) throw new InvalidSessionError();
  const tokenHash = hashToken(parsed.data);
  const { sequelize, RefreshToken, User } = getDb();

  const outcome = await sequelize.transaction(async (transaction): Promise<RefreshOutcome> => {
    const token = await RefreshToken.findOne({ where: { tokenHash }, lock: transaction.LOCK.UPDATE, transaction });
    if (!token) return { kind: "invalid" };
    if (token.revokedAt) return { kind: "invalid", revokeFamily: token.familyId };
    if (token.expiresAt.getTime() <= now.getTime()) return { kind: "invalid" };

    // Read the role again, so a demotion takes effect at the next refresh.
    const user = await User.findByPk(token.userId, { transaction });
    if (!user) return { kind: "invalid", revokeFamily: token.familyId };

    await token.update({ revokedAt: now }, { transaction });
    const tokens = await issueTokens(user, token.familyId, now, transaction);
    return { kind: "ok", session: { user: toAccountSummary(user), ...tokens } };
  });

  if (outcome.kind === "ok") return outcome.session;
  // Outside the transaction, so the revocation is kept even though the call fails.
  if (outcome.revokeFamily) await revokeFamily(outcome.revokeFamily, now);
  throw new InvalidSessionError();
}

async function revokeFamily(familyId: string, now: Date): Promise<void> {
  const { RefreshToken } = getDb();
  await RefreshToken.update({ revokedAt: now }, { where: { familyId, revokedAt: null } });
}

// Ends the session this refresh token belongs to. Idempotent: an unknown token is not an error.
export async function signOut(rawRefreshToken: string, now: Date = new Date()): Promise<void> {
  const parsed = rawTokenSchema.safeParse(rawRefreshToken);
  if (!parsed.success) return;
  const { RefreshToken } = getDb();
  const token = await RefreshToken.findOne({ where: { tokenHash: hashToken(parsed.data) } });
  if (token) await revokeFamily(token.familyId, now);
}

// The signed-in user's own details, or null when the account no longer exists.
export async function getAccount(viewer: Viewer): Promise<AccountSummary | null> {
  if (!viewer) return null;
  const { User } = getDb();
  const user = await User.findByPk(viewer.id);
  return user ? toAccountSummary(user) : null;
}
