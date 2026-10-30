import { createHash } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { AccountBlockedError, InvalidCredentialsError, InvalidSessionError, TooManyAttemptsError, ValidationError } from "../errors";
import { signAccessToken } from "./access-token";
import { getAccount, refreshSession, signIn, signOut, verifyAccessToken } from "./auth";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ATTEMPT_RETENTION_SECONDS,
  ATTEMPT_WINDOW_SECONDS,
  MAX_FAILED_ATTEMPTS_PER_EMAIL,
  MAX_FAILED_ATTEMPTS_PER_IP,
  REFRESH_TOKEN_TTL_SECONDS,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
} from "./constants";

const EMAIL = "admin@example.com";
const PASSWORD = "correct horse battery staple";
const IP = "203.0.113.7";
const MINUTE = 60_000;

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hash(PASSWORD);
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function createUser(role: UserRole = "admin", email = EMAIL) {
  return getDb().User.create({ email, passwordHash, role, emailConfirmedAt: new Date() });
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function failSignIns(count: number, email = EMAIL, ip = IP) {
  for (let i = 0; i < count; i++) {
    await expect(signIn({ email, password: "wrong", ip })).rejects.toBeInstanceOf(InvalidCredentialsError);
  }
}

describe("signIn", () => {
  it("issues an access token and a refresh token, and stores only the refresh token's hash", async () => {
    const user = await createUser();
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });

    expect(session.user).toEqual({ id: user.id, email: EMAIL, name: null, role: "admin" });
    expect(await verifyAccessToken(session.accessToken)).toEqual({ id: user.id, role: "admin" });
    expect(session.refreshToken.length).toBeGreaterThanOrEqual(43); // 32 bytes, base64url

    const rows = await getDb().RefreshToken.findAll({ raw: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256(session.refreshToken));
    expect(JSON.stringify(rows)).not.toContain(session.refreshToken);
    expect(rows[0].userId).toBe(user.id);
    expect(rows[0].revokedAt).toBeNull();
  });

  it("sets the documented lifetimes", async () => {
    await createUser();
    const now = new Date("2026-11-01T10:00:00Z");
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP }, now);
    expect(session.accessTokenExpiresAt.getTime()).toBe(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    expect(session.refreshTokenExpiresAt.getTime()).toBe(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(30 * 24 * 3600);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await createUser();
    const wrongPassword = await signIn({ email: EMAIL, password: "nope", ip: IP }).catch((e: unknown) => e);
    const unknownEmail = await signIn({ email: "nobody@example.com", password: "nope", ip: IP }).catch((e: unknown) => e);
    expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message);
  });

  it("normalises the email (trim, lowercase)", async () => {
    await createUser();
    const session = await signIn({ email: "  Admin@Example.COM \n", password: PASSWORD, ip: IP });
    expect(session.user.email).toBe(EMAIL);
  });

  it("rejects malformed input before touching the database", async () => {
    await expect(signIn({ email: "not-an-email", password: PASSWORD, ip: IP })).rejects.toBeInstanceOf(ValidationError);
    await expect(signIn({ email: EMAIL, password: "", ip: IP })).rejects.toBeInstanceOf(ValidationError);
    await expect(signIn({ email: EMAIL, password: "x".repeat(1025), ip: IP })).rejects.toBeInstanceOf(ValidationError);
    expect(await getDb().FailedSignIn.count()).toBe(0);
  });

  it("does not assume the user is an admin", async () => {
    await createUser("student");
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    expect(session.user.role).toBe("student");
    expect(await verifyAccessToken(session.accessToken)).toMatchObject({ role: "student" });
  });
});

describe("sign-in rate limiting", () => {
  it("locks an email after 5 failures, even for the correct password", async () => {
    await createUser();
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL);
    const error = await signIn({ email: EMAIL, password: PASSWORD, ip: "198.51.100.1" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TooManyAttemptsError);
    expect((error as TooManyAttemptsError).retryAfterSeconds).toBeGreaterThan(0);
    expect((error as TooManyAttemptsError).retryAfterSeconds).toBeLessThanOrEqual(ATTEMPT_WINDOW_SECONDS);
    expect(await getDb().RefreshToken.count()).toBe(0);
  });

  it("allows 4 failures, then the correct password", async () => {
    await createUser();
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL - 1);
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).resolves.toBeDefined();
  });

  it("locks an unknown email the same way, so lockout does not reveal accounts", async () => {
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL, "nobody@example.com");
    await expect(signIn({ email: "nobody@example.com", password: "x", ip: IP })).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it("does not lock other emails because of one email's failures", async () => {
    await createUser();
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL, "other@example.com", "198.51.100.2");
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).resolves.toBeDefined();
  });

  it("locks an IP after 20 failures across different emails", async () => {
    await createUser();
    const { FailedSignIn } = getDb();
    await FailedSignIn.bulkCreate(
      Array.from({ length: MAX_FAILED_ATTEMPTS_PER_IP }, (_, i) => ({ email: `guess${i}@example.com`, ip: IP })),
    );
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).rejects.toBeInstanceOf(TooManyAttemptsError);
    // Another IP is unaffected.
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: "198.51.100.3" })).resolves.toBeDefined();
  });

  it("lets the user in again once the failures leave the window", async () => {
    await createUser();
    const start = new Date("2026-11-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS_PER_EMAIL; i++) {
      await signIn({ email: EMAIL, password: "wrong", ip: IP }, start).catch(() => undefined);
    }
    const stillLocked = await signIn({ email: EMAIL, password: PASSWORD, ip: IP }, new Date(start.getTime() + 14 * MINUTE)).catch((e: unknown) => e);
    expect(stillLocked).toBeInstanceOf(TooManyAttemptsError);
    expect((stillLocked as TooManyAttemptsError).retryAfterSeconds).toBe(60);
    const later = new Date(start.getTime() + ATTEMPT_WINDOW_SECONDS * 1000 + 1000);
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP }, later)).resolves.toBeDefined();
  });

  it("clears the email's failures after a successful sign-in", async () => {
    await createUser();
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL - 1);
    await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    expect(await getDb().FailedSignIn.count({ where: { email: EMAIL } })).toBe(0);
    // A fresh run of 4 failures is allowed again.
    await failSignIns(MAX_FAILED_ATTEMPTS_PER_EMAIL - 1);
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).resolves.toBeDefined();
  });

  it("deletes old failure rows when a new failure is recorded", async () => {
    const { FailedSignIn } = getDb();
    const now = new Date("2026-11-01T10:00:00Z");
    const old = new Date(now.getTime() - (ATTEMPT_RETENTION_SECONDS + 60) * 1000);
    const recent = new Date(now.getTime() - 3600 * 1000);
    await FailedSignIn.bulkCreate([
      { email: "old@example.com", ip: "198.51.100.9", createdAt: old },
      { email: "recent@example.com", ip: "198.51.100.9", createdAt: recent },
    ]);
    await signIn({ email: EMAIL, password: "wrong", ip: IP }, now).catch(() => undefined);
    const emails = (await FailedSignIn.findAll({ raw: true })).map((row) => row.email).sort();
    expect(emails).toEqual(["admin@example.com", "recent@example.com"]);
  });
});

describe("refreshSession", () => {
  it("rotates: the old token stops working and the new one works", async () => {
    const user = await createUser();
    const first = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const second = await refreshSession(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(await verifyAccessToken(second.accessToken)).toEqual({ id: user.id, role: "admin" });

    const rows = await getDb().RefreshToken.findAll({ order: [["createdAt", "ASC"]] });
    expect(rows).toHaveLength(2);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(rows[1].revokedAt).toBeNull();
    expect(rows[0].familyId).toBe(rows[1].familyId);
    expect(rows[1].tokenHash).toBe(sha256(second.refreshToken));

    await expect(refreshSession(second.refreshToken)).resolves.toBeDefined();
  });

  it("revokes the whole family when a rotated token is presented again", async () => {
    await createUser();
    const first = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const second = await refreshSession(first.refreshToken);
    const third = await refreshSession(second.refreshToken);

    await expect(refreshSession(first.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);

    const rows = await getDb().RefreshToken.findAll();
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    // The newest token is dead too.
    await expect(refreshSession(third.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("does not touch other sessions (families) of the same user", async () => {
    await createUser();
    const phone = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const laptop = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await refreshSession(phone.refreshToken);
    await expect(refreshSession(phone.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);
    await expect(refreshSession(laptop.refreshToken)).resolves.toBeDefined();
  });

  it("rejects an expired refresh token", async () => {
    await createUser();
    const now = new Date("2026-11-01T10:00:00Z");
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP }, now);
    const afterExpiry = new Date(session.refreshTokenExpiresAt.getTime() + 1000);
    await expect(refreshSession(session.refreshToken, afterExpiry)).rejects.toBeInstanceOf(InvalidSessionError);
    // An expired token is not a reuse signal: nothing else is revoked.
    const justBefore = new Date(session.refreshTokenExpiresAt.getTime() - 1000);
    await expect(refreshSession(session.refreshToken, justBefore)).resolves.toBeDefined();
  });

  it("rejects unknown and malformed tokens", async () => {
    await expect(refreshSession("not-a-real-token")).rejects.toBeInstanceOf(InvalidSessionError);
    await expect(refreshSession("")).rejects.toBeInstanceOf(InvalidSessionError);
    await expect(refreshSession("x".repeat(5000))).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("rejects a token whose user was deleted", async () => {
    const user = await createUser();
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await user.destroy();
    await expect(refreshSession(session.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("reads the role again on refresh", async () => {
    const user = await createUser("admin");
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await user.update({ role: "student" });
    const refreshed = await refreshSession(session.refreshToken);
    expect(refreshed.user.role).toBe("student");
    expect(await verifyAccessToken(refreshed.accessToken)).toMatchObject({ role: "student" });
  });

  it("lets exactly one of two concurrent refreshes with the same token succeed", async () => {
    await createUser();
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const results = await Promise.allSettled([
      refreshSession(session.refreshToken),
      refreshSession(session.refreshToken),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(InvalidSessionError);
  });
});

describe("signOut", () => {
  it("revokes the whole family of the token", async () => {
    await createUser();
    const first = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const second = await refreshSession(first.refreshToken);
    await signOut(second.refreshToken);
    expect((await getDb().RefreshToken.findAll()).every((row) => row.revokedAt !== null)).toBe(true);
    await expect(refreshSession(second.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("is idempotent and ignores unknown or malformed tokens", async () => {
    await createUser();
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await signOut(session.refreshToken);
    await expect(signOut(session.refreshToken)).resolves.toBeUndefined();
    await expect(signOut("unknown-token")).resolves.toBeUndefined();
    await expect(signOut("")).resolves.toBeUndefined();
  });

  it("leaves other sessions alone", async () => {
    await createUser();
    const phone = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    const laptop = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await signOut(phone.refreshToken);
    await expect(refreshSession(laptop.refreshToken)).resolves.toBeDefined();
  });
});

describe("verifyAccessToken", () => {
  const user = { id: "11111111-1111-4111-8111-111111111111", role: "admin" as const };

  it("accepts a fresh token", async () => {
    const { token } = await signAccessToken(user);
    expect(await verifyAccessToken(token)).toEqual(user);
  });

  it("rejects a token after it expires, without sleeping", async () => {
    const issued = new Date("2026-11-01T10:00:00Z");
    const { token } = await signAccessToken(user, issued);
    const lastGoodMoment = new Date(issued.getTime() + (ACCESS_TOKEN_TTL_SECONDS - 1) * 1000);
    const expired = new Date(issued.getTime() + (ACCESS_TOKEN_TTL_SECONDS + 1) * 1000);
    expect(await verifyAccessToken(token, lastGoodMoment)).toEqual(user);
    expect(await verifyAccessToken(token, expired)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const { token } = await signAccessToken(user);
    const [header, payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "student", sub: "x" }),
    ).toString("base64url");
    expect(await verifyAccessToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
    const flipped = signature.startsWith("A") ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    expect(await verifyAccessToken(`${header}.${payload}.${flipped}`)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const other = new TextEncoder().encode("a-completely-different-secret-of-32+chars");
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(other);
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("rejects a token with alg none", async () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: user.id,
      role: "admin",
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat: now,
      exp: now + 600,
    })}.`;
    expect(await verifyAccessToken(unsigned)).toBeNull();
  });

  it("rejects a token for another audience or issuer", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const now = Math.floor(Date.now() / 1000);
    for (const [issuer, audience] of [["someone-else", TOKEN_AUDIENCE], [TOKEN_ISSUER, "someone-else"]]) {
      const token = await new SignJWT({ role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 600)
        .sign(key);
      expect(await verifyAccessToken(token)).toBeNull();
    }
  });

  it("returns null for garbage and for an unknown role", async () => {
    expect(await verifyAccessToken("")).toBeNull();
    expect(await verifyAccessToken("garbage")).toBeNull();
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ role: "superuser" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(key);
    expect(await verifyAccessToken(token)).toBeNull();
  });
});

describe("getAccount", () => {
  it("returns the account for a viewer, null for anonymous or a deleted user", async () => {
    const user = await createUser();
    expect(await getAccount({ id: user.id, role: "admin" })).toEqual({ id: user.id, email: EMAIL, name: null, role: "admin" });
    expect(await getAccount(null)).toBeNull();
    await user.destroy();
    expect(await getAccount({ id: user.id, role: "admin" })).toBeNull();
  });
});

describe("a blocked account", () => {
  const block = (email = EMAIL) => getDb().User.update({ blockedAt: new Date() }, { where: { email } });

  it("is refused with the right password, without tokens or a recorded failure", async () => {
    await createUser("student");
    await block();
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).rejects.toBeInstanceOf(AccountBlockedError);
    expect(await getDb().RefreshToken.count()).toBe(0);
    expect(await getDb().FailedSignIn.count()).toBe(0);
  });

  it("gets the usual failure for a wrong password, which says nothing about the block", async () => {
    await createUser("student");
    await block();
    await expect(signIn({ email: EMAIL, password: "wrong", ip: IP })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(await getDb().FailedSignIn.count()).toBe(1);
  });

  it("can sign in again once unblocked", async () => {
    await createUser("student");
    await block();
    await getDb().User.update({ blockedAt: null }, { where: { email: EMAIL } });
    await expect(signIn({ email: EMAIL, password: PASSWORD, ip: IP })).resolves.toBeDefined();
  });

  it("cannot refresh: the session is invalid and its family is revoked", async () => {
    await createUser("student");
    const session = await signIn({ email: EMAIL, password: PASSWORD, ip: IP });
    await block();
    await expect(refreshSession(session.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError);
    const rows = await getDb().RefreshToken.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).not.toBeNull();
  });
});
