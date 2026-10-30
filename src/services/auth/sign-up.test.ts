import { createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import {
  EmailNotConfirmedError,
  InvalidConfirmationTokenError,
  InvalidCredentialsError,
  TooManyAttemptsError,
  ValidationError,
} from "../errors";
import { signIn } from "./auth";
import {
  CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS,
  CONFIRMATION_EMAILS_PER_DAY,
  CONFIRMATION_TOKEN_TTL_SECONDS,
  SIGN_UP_LIMIT_PER_IP,
  UNCONFIRMED_ACCOUNT_TTL_SECONDS,
} from "./constants";
import { confirmEmailHandler } from "./emails";
import { confirmEmail, deleteUnconfirmedAccounts, resendConfirmation, signUp } from "./sign-up";

const EMAIL = "new.student@example.com";
const PASSWORD = "a-long-enough-password";
const IP = "203.0.113.9";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const T0 = new Date("2026-11-01T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

beforeAll(() => {
  process.env.APP_URL = "http://app.test";
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  delete process.env.APP_URL;
  await closeDb();
});

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const userByEmail = (email = EMAIL) => getDb().User.scope("withPasswordHash").findOne({ where: { email } });
const jobs = () => getDb().EmailJob.findAll({ order: [["createdAt", "ASC"]] });

// Runs the confirm-email handler the way the sender would and returns the raw token from the link.
async function mintToken(jobId: string, now: Date = T0): Promise<string> {
  const job = (await getDb().EmailJob.findByPk(jobId))!;
  const content = await confirmEmailHandler(
    { id: job.id, kind: job.kind, toEmail: job.toEmail, payload: job.payload, attempts: 1 },
    now,
  );
  const match = content?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("no link in the email");
  return match[1];
}

async function confirmedUser(email = EMAIL) {
  return getDb().User.create({ email, passwordHash: await hash(PASSWORD), emailConfirmedAt: new Date() });
}

describe("signUp: validation", () => {
  it("reports the offending field names only", async () => {
    const attempt = signUp({ email: "nope", password: "short", name: "x".repeat(101), ip: IP }, T0);
    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt).rejects.toMatchObject({ fields: ["email", "password", "name"] });
    expect(await getDb().User.count()).toBe(0);
    expect(await getDb().RateLimitEvent.count()).toBe(0);
  });

  it("accepts a 10 character password with no composition rules, and refuses 9 or more than 1024", async () => {
    await expect(signUp({ email: EMAIL, password: "aaaaaaaaa", ip: IP }, T0)).rejects.toMatchObject({ fields: ["password"] });
    await expect(signUp({ email: EMAIL, password: "a".repeat(1025), ip: IP }, T0)).rejects.toMatchObject({
      fields: ["password"],
    });
    await signUp({ email: EMAIL, password: "aaaaaaaaaa", ip: IP }, T0);
    expect(await getDb().User.count()).toBe(1);
  });

  it("trims and lowercases the email, trims the name and stores an empty name as null", async () => {
    await signUp({ email: "  New.Student@Example.com ", password: PASSWORD, name: "  Sam  ", ip: IP }, T0);
    const user = (await userByEmail())!;
    expect(user.name).toBe("Sam");
    await signUp({ email: "other@example.com", password: PASSWORD, name: "   ", ip: "198.51.100.1" }, T0);
    expect((await userByEmail("other@example.com"))!.name).toBeNull();
    await signUp({ email: "third@example.com", password: PASSWORD, ip: "198.51.100.2" }, T0);
    expect((await userByEmail("third@example.com"))!.name).toBeNull();
  });
});

describe("signUp: a new address", () => {
  it("creates an unconfirmed student with an Argon2 hash and one confirm-email job without a secret", async () => {
    const result = await signUp({ email: EMAIL, password: PASSWORD, name: "Sam", ip: IP }, T0);
    const user = (await userByEmail())!;
    expect(user.role).toBe("student");
    expect(user.emailConfirmedAt).toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(user.passwordHash, PASSWORD)).toBe(true);

    const [job, ...rest] = await jobs();
    expect(rest).toHaveLength(0);
    expect(result).toEqual({ jobId: job.id });
    expect(job.kind).toBe("confirm-email");
    expect(job.toEmail).toBe(EMAIL);
    expect(job.payload).toEqual({ userId: user.id });
    expect(await getDb().EmailConfirmation.count()).toBe(0); // the token is minted at send time
  });

  it("leaves nothing behind when the transaction fails", async () => {
    const { sequelize } = getDb();
    await sequelize.query("ALTER TABLE email_jobs ADD CONSTRAINT tmp_fail CHECK (kind <> 'confirm-email')");
    try {
      await expect(signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0)).rejects.toThrow();
    } finally {
      await sequelize.query("ALTER TABLE email_jobs DROP CONSTRAINT tmp_fail");
    }
    expect(await getDb().User.count()).toBe(0);
    expect(await getDb().RateLimitEvent.count({ where: { action: "confirmation-email" } })).toBe(0);
  });

  it("cannot sign in before confirming, and can after", async () => {
    const { jobId } = await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP }, at(SECOND))).rejects.toBeInstanceOf(
      EmailNotConfirmedError,
    );
    await confirmEmail(await mintToken(jobId!), at(2 * SECOND));
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP }, at(3 * SECOND));
    expect(session.user.email).toBe(EMAIL);
  });
});

describe("signUp: an existing unconfirmed address (last sign-up wins)", () => {
  it("replaces the password and name, deletes old unused links and sends a fresh confirmation", async () => {
    const first = await signUp({ email: EMAIL, password: PASSWORD, name: "Old", ip: IP }, T0);
    const oldToken = await mintToken(first.jobId!);

    const second = await signUp({ email: EMAIL, password: "a-brand-new-password", name: "New", ip: IP }, at(2 * MINUTE));
    expect(second.jobId).not.toBeNull();
    expect(second.jobId).not.toBe(first.jobId);

    expect(await getDb().User.count()).toBe(1);
    const user = (await userByEmail())!;
    expect(user.name).toBe("New");
    expect(await verify(user.passwordHash, "a-brand-new-password")).toBe(true);
    expect(await verify(user.passwordHash, PASSWORD)).toBe(false);

    // The old link no longer works; the new one does.
    await expect(confirmEmail(oldToken, at(3 * MINUTE))).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
    const newToken = await mintToken(second.jobId!);
    await confirmEmail(newToken, at(3 * MINUTE));
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP }, at(4 * MINUTE))).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await signIn({ email: EMAIL, password: "a-brand-new-password", ip: IP }, at(4 * MINUTE));
  });

  it("keeps the existing link when the per-address limit skips the new email", async () => {
    const first = await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    const token = await mintToken(first.jobId!);
    const second = await signUp({ email: EMAIL, password: "another-long-password", ip: IP }, at(10 * SECOND));
    expect(second).toEqual({ jobId: null });
    await confirmEmail(token, at(20 * SECOND));
  });
});

describe("signUp: an existing confirmed address", () => {
  it("changes nothing and queues an already-registered email", async () => {
    const existing = await confirmedUser();
    const before = (await userByEmail())!;
    const result = await signUp({ email: EMAIL, password: "attacker-chosen-password", name: "Evil", ip: IP }, T0);

    const after = (await userByEmail())!;
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.name).toBeNull();
    expect(after.emailConfirmedAt).toEqual(existing.emailConfirmedAt);

    const [job] = await jobs();
    expect(result).toEqual({ jobId: job.id });
    expect(job.kind).toBe("already-registered");
    expect(job.payload).toEqual({});
    expect(await getDb().EmailConfirmation.count()).toBe(0);
  });

  it("gives the same result shape as a new address (no enumeration)", async () => {
    await confirmedUser("old@example.com");
    const existing = await signUp({ email: "old@example.com", password: PASSWORD, ip: "198.51.100.1" }, T0);
    const fresh = await signUp({ email: "fresh@example.com", password: PASSWORD, ip: "198.51.100.2" }, T0);
    expect(Object.keys(existing)).toEqual(Object.keys(fresh));
    expect(typeof existing.jobId).toBe(typeof fresh.jobId);
  });
});

describe("signUp: a blocked address", () => {
  it("changes nothing, sends nothing and answers like any other address", async () => {
    const blockedAt = new Date("2026-10-30T10:00:00Z");
    for (const confirmed of [true, false]) {
      await truncateAllTables();
      await getDb().User.create({
        email: EMAIL,
        passwordHash: await hash(PASSWORD),
        emailConfirmedAt: confirmed ? new Date() : null,
        blockedAt,
      });
      const before = (await userByEmail())!;
      const result = await signUp({ email: EMAIL, password: "attacker-chosen-password", name: "Evil", ip: IP }, T0);
      expect(result).toEqual({ jobId: null });
      const after = (await userByEmail())!;
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.name).toBeNull();
      expect(after.blockedAt).toEqual(blockedAt);
      expect(await jobs()).toHaveLength(0);
    }
  });
});

describe("signUp: limits", () => {
  it("refuses a 6th sign-up from one IP within an hour, with a retry time, and frees it later", async () => {
    for (let i = 0; i < SIGN_UP_LIMIT_PER_IP; i++) {
      await signUp({ email: `s${i}@example.com`, password: PASSWORD, ip: IP }, at(i * MINUTE));
    }
    const attempt = signUp({ email: "s9@example.com", password: PASSWORD, ip: IP }, at(10 * MINUTE));
    await expect(attempt).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(attempt).rejects.toMatchObject({ retryAfterSeconds: 50 * 60 });
    expect(await userByEmail("s9@example.com")).toBeNull();

    // Another IP is not affected; the first IP is free again once the oldest event is an hour old.
    await signUp({ email: "s9@example.com", password: PASSWORD, ip: "198.51.100.7" }, at(10 * MINUTE));
    await signUp({ email: "s10@example.com", password: PASSWORD, ip: IP }, at(HOUR + SECOND));
  });

  it("does not count an invalid request against the IP", async () => {
    for (let i = 0; i < SIGN_UP_LIMIT_PER_IP + 2; i++) {
      await expect(signUp({ email: "bad", password: PASSWORD, ip: IP }, at(i))).rejects.toBeInstanceOf(ValidationError);
    }
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, at(MINUTE));
  });

  it("sends at most one confirmation-type email a minute to an address, silently", async () => {
    const first = await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    const second = await signUp({ email: EMAIL, password: PASSWORD, ip: "198.51.100.1" }, at(CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS * SECOND - SECOND));
    expect(first.jobId).not.toBeNull();
    expect(second).toEqual({ jobId: null });
    const third = await signUp({ email: EMAIL, password: PASSWORD, ip: "198.51.100.1" }, at(CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS * SECOND));
    expect(third.jobId).not.toBeNull();
    expect(await jobs()).toHaveLength(2);
  });

  it("also limits already-registered emails to a confirmed address", async () => {
    await confirmedUser();
    const first = await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    const second = await signUp({ email: EMAIL, password: PASSWORD, ip: "198.51.100.1" }, at(5 * SECOND));
    expect(first.jobId).not.toBeNull();
    expect(second.jobId).toBeNull();
  });

  it("sends at most 5 a day to an address, then again once the oldest is a day old", async () => {
    for (let i = 0; i < CONFIRMATION_EMAILS_PER_DAY; i++) {
      const result = await signUp({ email: EMAIL, password: PASSWORD, ip: `198.51.100.${i}` }, at(i * 2 * MINUTE));
      expect(result.jobId, `email ${i + 1}`).not.toBeNull();
    }
    const sixth = await signUp({ email: EMAIL, password: PASSWORD, ip: "198.51.100.50" }, at(HOUR));
    expect(sixth.jobId).toBeNull();
    const later = await signUp({ email: EMAIL, password: PASSWORD, ip: "198.51.100.51" }, at(DAY + MINUTE));
    expect(later.jobId).not.toBeNull();
  });

  it("deletes rate-limit rows older than 2 days when a new one is recorded", async () => {
    await getDb().RateLimitEvent.create({ action: "sign-up", subject: "198.51.100.99", createdAt: at(-3 * DAY) });
    await getDb().RateLimitEvent.create({ action: "sign-up", subject: "198.51.100.98", createdAt: at(-1 * DAY) });
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    const subjects = (await getDb().RateLimitEvent.findAll()).map((row) => row.subject);
    expect(subjects).not.toContain("198.51.100.99");
    expect(subjects).toContain("198.51.100.98");
  });
});

describe("confirmEmail", () => {
  async function pending(now = T0) {
    const { jobId } = await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, now);
    return mintToken(jobId!);
  }

  it("confirms once, stores only the hash, and creates no session", async () => {
    const token = await pending();
    const rows = await getDb().EmailConfirmation.findAll({ raw: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256(token));
    expect(JSON.stringify(rows)).not.toContain(token);

    const result = await confirmEmail(token, at(HOUR));
    expect(result).toBeUndefined();
    expect((await userByEmail())!.emailConfirmedAt).toEqual(at(HOUR));
    expect((await getDb().EmailConfirmation.findOne())!.usedAt).toEqual(at(HOUR));
    expect(await getDb().RefreshToken.count()).toBe(0);
  });

  it("refuses the same token a second time", async () => {
    const token = await pending();
    await confirmEmail(token, at(MINUTE));
    await expect(confirmEmail(token, at(2 * MINUTE))).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
    expect((await userByEmail())!.emailConfirmedAt).toEqual(at(MINUTE)); // the first time is kept
  });

  it("is valid just under 24 hours and refused at 24 hours", async () => {
    const token = await pending();
    const expiresAt = (await getDb().EmailConfirmation.findOne())!.expiresAt;
    expect(expiresAt).toEqual(at(CONFIRMATION_TOKEN_TTL_SECONDS * SECOND));
    await expect(confirmEmail(token, new Date(expiresAt.getTime()))).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
    expect((await userByEmail())!.emailConfirmedAt).toBeNull();
    await confirmEmail(token, new Date(expiresAt.getTime() - SECOND));
  });

  it("refuses unknown, empty, oversized and non-string tokens with the same error", async () => {
    await pending();
    for (const bad of ["unknown-token", "", "x".repeat(600), 42 as unknown as string]) {
      await expect(confirmEmail(bad, at(MINUTE))).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
    }
    expect((await userByEmail())!.emailConfirmedAt).toBeNull();
  });

  it("refuses a token whose user has been deleted", async () => {
    const token = await pending();
    await getDb().User.destroy({ where: { email: EMAIL } });
    await expect(confirmEmail(token, at(MINUTE))).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
  });

  it("lets only one of two simultaneous uses succeed", async () => {
    const token = await pending();
    const outcomes = await Promise.allSettled([confirmEmail(token, at(MINUTE)), confirmEmail(token, at(MINUTE))]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
  });
});

describe("resendConfirmation", () => {
  it("queues a confirm-email job for an unconfirmed account", async () => {
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    const result = await resendConfirmation({ email: " New.Student@example.com " }, at(2 * MINUTE));
    expect(result.jobId).not.toBeNull();
    const all = await jobs();
    expect(all).toHaveLength(2);
    expect(all[1].kind).toBe("confirm-email");
  });

  it("sends nothing for a confirmed or unknown address but answers the same way", async () => {
    await confirmedUser("done@example.com");
    const confirmed = await resendConfirmation({ email: "done@example.com" }, T0);
    const unknown = await resendConfirmation({ email: "nobody@example.com" }, T0);
    expect(confirmed).toEqual({ jobId: null });
    expect(unknown).toEqual({ jobId: null });
    expect(await jobs()).toHaveLength(0);
  });

  it("sends nothing to a blocked account", async () => {
    await getDb().User.create({ email: EMAIL, passwordHash: "x", blockedAt: new Date() });
    expect(await resendConfirmation({ email: EMAIL }, T0)).toEqual({ jobId: null });
    expect(await jobs()).toHaveLength(0);
  });

  it("limits every address alike: once a minute, 5 a day, counting unknown addresses too", async () => {
    for (const email of [EMAIL, "nobody@example.com"]) {
      await resendConfirmation({ email }, T0);
      const attempt = resendConfirmation({ email }, at(10 * SECOND));
      await expect(attempt).rejects.toBeInstanceOf(TooManyAttemptsError);
      await expect(attempt).rejects.toMatchObject({ retryAfterSeconds: 50 });
    }
    for (let i = 1; i < CONFIRMATION_EMAILS_PER_DAY; i++) {
      await resendConfirmation({ email: "nobody@example.com" }, at(i * 2 * MINUTE));
    }
    const attempt = resendConfirmation({ email: "nobody@example.com" }, at(HOUR));
    await expect(attempt).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(attempt).rejects.toMatchObject({ retryAfterSeconds: (DAY - HOUR) / SECOND });
  });

  it("shares the per-address limit with sign-up", async () => {
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    await expect(resendConfirmation({ email: EMAIL }, at(5 * SECOND))).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it("validates the email", async () => {
    await expect(resendConfirmation({ email: "nope" }, T0)).rejects.toMatchObject({ fields: ["email"] });
  });
});

describe("signIn with an unconfirmed account", () => {
  it("answers invalid credentials for a wrong password and records the failure", async () => {
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    await expect(signIn({ email: EMAIL, password: "wrong-password", ip: IP }, at(MINUTE))).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(await getDb().FailedSignIn.count()).toBe(1);
  });

  it("refuses a correct password without tokens, without a failure, and keeps earlier failures", async () => {
    await signUp({ email: EMAIL, password: PASSWORD, ip: IP }, T0);
    await expect(signIn({ email: EMAIL, password: "wrong-password", ip: IP }, at(MINUTE))).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP }, at(2 * MINUTE))).rejects.toBeInstanceOf(
      EmailNotConfirmedError,
    );
    expect(await getDb().RefreshToken.count()).toBe(0);
    expect(await getDb().FailedSignIn.count()).toBe(1);
  });
});

describe("deleteUnconfirmedAccounts", () => {
  it("deletes students unconfirmed for more than 7 days and keeps admins, confirmed and younger accounts", async () => {
    const { User, EmailConfirmation } = getDb();
    const make = (email: string, extra: Record<string, unknown>) =>
      User.create({ email, passwordHash: "x", ...extra } as never);
    const old = at(-(UNCONFIRMED_ACCOUNT_TTL_SECONDS * SECOND + MINUTE));
    const stale = await make("stale@example.com", { createdAt: old });
    await EmailConfirmation.create({ userId: stale.id, tokenHash: sha256("t"), expiresAt: at(DAY) });
    await make("young@example.com", { createdAt: at(-(UNCONFIRMED_ACCOUNT_TTL_SECONDS * SECOND - MINUTE)) });
    await make("confirmed@example.com", { createdAt: old, emailConfirmedAt: at(-DAY) });
    await make("admin@example.com", { createdAt: old, role: "admin" });
    await make("blocked@example.com", { createdAt: old, blockedAt: at(-DAY) });

    expect(await deleteUnconfirmedAccounts(T0)).toBe(1);
    const left = (await User.findAll()).map((u) => u.email).sort();
    expect(left).toEqual(["admin@example.com", "blocked@example.com", "confirmed@example.com", "young@example.com"]);
    expect(await EmailConfirmation.count()).toBe(0); // cascade
    expect(await deleteUnconfirmedAccounts(T0)).toBe(0);
  });
});
