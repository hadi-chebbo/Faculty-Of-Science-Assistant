import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, InvalidConfirmationTokenError, NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { confirmEmail } from "../auth/sign-up";
import { hashToken } from "../auth/token-hash";
import { signUp } from "../auth/sign-up";
import { blockUser, confirmUserEmail, deleteUser, getUserDetail, listUsers, unblockUser } from "./users";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

const DAY = 86_400_000;
const T0 = new Date("2026-10-01T10:00:00Z").getTime();

async function make(email: string, opts: { role?: UserRole; confirmed?: boolean; daysAgo?: number; name?: string | null } = {}) {
  const row = await getDb().User.create({
    email,
    passwordHash: "not-a-real-hash",
    role: opts.role ?? "student",
    name: opts.name ?? null,
    emailConfirmedAt: opts.confirmed === false ? null : new Date(T0),
    createdAt: new Date(T0 - (opts.daysAgo ?? 0) * DAY),
  });
  return row;
}

async function admin(): Promise<NonNullable<Viewer>> {
  const row = await make("admin@example.com", { role: "admin", daysAgo: 100 });
  return { id: row.id, role: "admin" };
}

describe("listUsers", () => {
  it("is for the admin only", async () => {
    const student = await make("s@example.com");
    await expect(listUsers({ id: student.id, role: "student" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listUsers(null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists newest sign-up first with the fields", async () => {
    const a = await admin();
    await make("old@example.com", { daysAgo: 10, name: "Old" });
    await make("new@example.com", { daysAgo: 1, confirmed: false });
    const result = await listUsers(a);
    expect(result.items.map((u) => u.email)).toEqual(["new@example.com", "old@example.com", "admin@example.com"]);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.items[0]).toMatchObject({ name: null, role: "student", emailConfirmedAt: null, lastActiveAt: null });
    expect(result.items[1]).toMatchObject({ name: "Old", emailConfirmedAt: new Date(T0).toISOString() });
    expect(result.items[1].createdAt).toBe(new Date(T0 - 10 * DAY).toISOString());
  });

  it("takes last activity from the newest refresh token, revoked or not", async () => {
    const a = await admin();
    const u = await make("u@example.com");
    const { RefreshToken } = getDb();
    const token = (hash: string, days: number, revoked: boolean) =>
      RefreshToken.create({
        userId: u.id,
        tokenHash: hash.padEnd(64, "0"),
        familyId: "11111111-1111-4111-8111-111111111111",
        expiresAt: new Date(T0 + 30 * DAY),
        revokedAt: revoked ? new Date(T0) : null,
        createdAt: new Date(T0 - days * DAY),
      });
    await token("a", 5, true);
    await token("b", 2, true);
    await token("c", 9, false);
    const items = (await listUsers(a, { q: "u@" })).items;
    expect(items).toHaveLength(1);
    expect(items[0].lastActiveAt).toBe(new Date(T0 - 2 * DAY).toISOString());
  });

  it("searches an email by part, ignoring case", async () => {
    const a = await admin();
    await make("Alice.Smith@example.com");
    await make("bob@example.com");
    expect((await listUsers(a, { q: "ALICE" })).items.map((u) => u.email)).toEqual(["alice.smith@example.com"]);
    expect((await listUsers(a, { q: "  smith@exa " })).total).toBe(1);
    expect((await listUsers(a, { q: "" })).total).toBe(3);
    expect((await listUsers(a, { q: "nobody" })).items).toEqual([]);
  });

  it("treats % _ and backslash in the search as plain characters", async () => {
    const a = await admin();
    await make("a_b@example.com");
    await make("axb@example.com");
    await make("100%@example.com");
    await make("back\\slash@example.com");
    expect((await listUsers(a, { q: "a_b" })).items.map((u) => u.email)).toEqual(["a_b@example.com"]);
    expect((await listUsers(a, { q: "%" })).items.map((u) => u.email)).toEqual(["100%@example.com"]);
    expect((await listUsers(a, { q: "\\" })).items.map((u) => u.email)).toEqual(["back\\slash@example.com"]);
  });

  it("filters unconfirmed and combines it with the search", async () => {
    const a = await admin();
    await make("one@example.com", { confirmed: false, daysAgo: 1 });
    await make("two@example.com", { confirmed: false, daysAgo: 2 });
    await make("three@example.com", { daysAgo: 3 });
    expect((await listUsers(a, { unconfirmed: true })).items.map((u) => u.email)).toEqual(["one@example.com", "two@example.com"]);
    expect((await listUsers(a, { unconfirmed: true, q: "two" })).items.map((u) => u.email)).toEqual(["two@example.com"]);
    expect((await listUsers(a, { unconfirmed: true, q: "three" })).total).toBe(0);
  });

  it("pages with a stable total", async () => {
    const a = await admin();
    for (let i = 1; i <= 4; i++) await make(`u${i}@example.com`, { daysAgo: i });
    const p1 = await listUsers(a, { pageSize: 2 });
    const p2 = await listUsers(a, { pageSize: 2, page: 2 });
    const p3 = await listUsers(a, { pageSize: 2, page: 3 });
    expect([p1.total, p2.total, p3.total]).toEqual([5, 5, 5]);
    expect(p1.items.map((u) => u.email)).toEqual(["u1@example.com", "u2@example.com"]);
    expect(p2.items.map((u) => u.email)).toEqual(["u3@example.com", "u4@example.com"]);
    expect(p3.items.map((u) => u.email)).toEqual(["admin@example.com"]);
    expect(p2.pageSize).toBe(2);
  });

  it("rejects unusable input", async () => {
    const a = await admin();
    await expect(listUsers(a, { page: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(listUsers(a, { q: "x".repeat(300) })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getUserDetail", () => {
  const NOW = new Date("2026-10-29T12:00:00Z");
  const MISSING_ID = "33333333-3333-4333-8333-333333333333";

  it("is for the admin only", async () => {
    const student = await make("s@example.com");
    await expect(getUserDetail({ id: student.id, role: "student" }, student.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getUserDetail(null, student.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("is not found for an unknown or malformed id", async () => {
    const a = await admin();
    for (const id of [MISSING_ID, "not-a-uuid", ""]) {
      await expect(getUserDetail(a, id)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("returns the profile with last activity from the newest refresh token", async () => {
    const a = await admin();
    const u = await make("p@example.com", { name: "Pat", confirmed: false });
    const detail = await getUserDetail(a, u.id, NOW);
    expect(detail).toMatchObject({
      id: u.id,
      email: "p@example.com",
      name: "Pat",
      role: "student",
      emailConfirmedAt: null,
      lastActiveAt: null,
      createdAt: new Date(T0).toISOString(),
    });
    await getDb().RefreshToken.create({
      userId: u.id,
      tokenHash: "a".padEnd(64, "0"),
      familyId: "11111111-1111-4111-8111-111111111111",
      expiresAt: new Date(NOW.getTime() + DAY),
      createdAt: new Date(T0 + DAY),
    });
    expect((await getUserDetail(a, u.id, NOW)).lastActiveAt).toBe(new Date(T0 + DAY).toISOString());
  });

  it("counts only this user's rows, and not soft-deleted cards", async () => {
    const a = await admin();
    const u = await make("u@example.com");
    const other = await make("other@example.com");
    const { Course, Resource, Bookmark, Completion, Todo, Milestone, StudyDay } = getDb();
    const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
    const files = await Promise.all(
      ["A", "B", "C"].map((title) => Resource.create({ courseId: course.id, type: "lecture", title, fileKey: "k", isPublished: true })),
    );
    for (const owner of [u, other]) {
      for (const f of files.slice(0, owner === u ? 3 : 2)) {
        await Bookmark.create({ userId: owner.id, resourceId: f.id });
      }
      for (const f of files.slice(0, owner === u ? 2 : 3)) {
        await Completion.create({ userId: owner.id, resourceId: f.id });
      }
    }
    const card = (userId: string, position: number, deletedAt: Date | null) =>
      Todo.create({ userId, status: "todo", position, title: `c${position}`, deletedAt });
    await card(u.id, 0, null);
    await card(u.id, 1, null);
    await card(u.id, 2, NOW);
    await card(other.id, 0, null);
    await Milestone.create({ userId: u.id, key: "first_file" });
    await Milestone.create({ userId: other.id, key: "first_file" });
    await Milestone.create({ userId: other.id, key: "files_10" });
    for (const day of ["2026-10-27", "2026-10-28", "2026-10-29"]) await StudyDay.create({ userId: u.id, day });
    await StudyDay.create({ userId: other.id, day: "2026-10-29" });

    expect((await getUserDetail(a, u.id, NOW)).counts).toEqual({ saved: 3, cards: 2, completions: 2, milestones: 1, activeDays: 3 });
    expect((await getUserDetail(a, other.id, NOW)).counts).toEqual({ saved: 2, cards: 1, completions: 3, milestones: 2, activeDays: 1 });
  });

  it("counts open sessions: not revoked and not expired", async () => {
    const a = await admin();
    const u = await make("u@example.com");
    const other = await make("other@example.com");
    const token = (userId: string, hash: string, expiresInDays: number, revoked: boolean) =>
      getDb().RefreshToken.create({
        userId,
        tokenHash: hash.padEnd(64, "0"),
        familyId: "11111111-1111-4111-8111-111111111111",
        expiresAt: new Date(NOW.getTime() + expiresInDays * DAY),
        revokedAt: revoked ? NOW : null,
        createdAt: new Date(NOW.getTime() - 40 * DAY),
      });
    await token(u.id, "a", 5, false);
    await token(u.id, "b", 20, false);
    await token(u.id, "c", 5, true);
    await token(u.id, "d", -1, false);
    await token(other.id, "e", 5, false);
    expect((await getUserDetail(a, u.id, NOW)).sessions).toBe(2);
  });

  it("counts failed sign-ins of this email in the last 7 days", async () => {
    const a = await admin();
    const u = await make("Mixed@example.com");
    const { FailedSignIn } = getDb();
    const fail = (email: string, daysAgo: number) =>
      FailedSignIn.create({ email, ip: "10.0.0.1", createdAt: new Date(NOW.getTime() - daysAgo * DAY) });
    await fail("mixed@example.com", 0.5);
    await fail("mixed@example.com", 3);
    await fail("mixed@example.com", 6.9);
    await fail("mixed@example.com", 7.1);
    await fail("someone-else@example.com", 1);
    const detail = await getUserDetail(a, u.id, NOW);
    expect(detail.failedSignIns).toEqual({ count: 3, latestAt: new Date(NOW.getTime() - 0.5 * DAY).toISOString() });

    const quiet = await make("quiet@example.com");
    expect((await getUserDetail(a, quiet.id, NOW)).failedSignIns).toEqual({ count: 0, latestAt: null });
  });
});

describe("confirmUserEmail", () => {
  const NOW = new Date("2026-10-30T09:00:00Z");

  it("is for the admin only", async () => {
    const u = await make("u@example.com", { confirmed: false });
    const student = await make("s@example.com");
    await expect(confirmUserEmail({ id: student.id, role: "student" }, u.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(confirmUserEmail(null, u.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getDb().User.findByPk(u.id))!.emailConfirmedAt).toBeNull();
  });

  it("confirms an unconfirmed user", async () => {
    const a = await admin();
    const u = await make("u@example.com", { confirmed: false });
    const result = await confirmUserEmail(a, u.id, NOW);
    expect(result).toEqual({ emailConfirmedAt: NOW.toISOString() });
    expect((await getDb().User.findByPk(u.id))!.emailConfirmedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("stops the outstanding confirmation links", async () => {
    const a = await admin();
    const u = await make("u@example.com", { confirmed: false });
    await getDb().EmailConfirmation.create({
      userId: u.id,
      tokenHash: hashToken("a".repeat(43)),
      expiresAt: new Date(NOW.getTime() + DAY),
    });
    await confirmUserEmail(a, u.id, NOW);
    await expect(confirmEmail("a".repeat(43), NOW)).rejects.toBeInstanceOf(InvalidConfirmationTokenError);
    expect(await getDb().EmailConfirmation.count({ where: { userId: u.id } })).toBe(0);
  });

  it("is harmless twice and keeps the first time", async () => {
    const a = await admin();
    const u = await make("u@example.com", { confirmed: false });
    await confirmUserEmail(a, u.id, NOW);
    const later = new Date(NOW.getTime() + DAY);
    expect(await confirmUserEmail(a, u.id, later)).toEqual({ emailConfirmedAt: NOW.toISOString() });
  });

  it("answers NotFoundError for a malformed or unknown id", async () => {
    const a = await admin();
    await expect(confirmUserEmail(a, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(confirmUserEmail(a, "33333333-3333-4333-8333-333333333333")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("blockUser and unblockUser", () => {
  const T1 = new Date("2026-10-02T10:00:00Z");
  const T2 = new Date("2026-10-03T10:00:00Z");

  async function tokens(userId: string, count: number) {
    for (let i = 0; i < count; i++) {
      await getDb().RefreshToken.create({
        userId,
        tokenHash: hashToken(`${userId}-${i}`.padEnd(43, "x")),
        familyId: `00000000-0000-4000-8000-00000000000${i}`,
        expiresAt: new Date(T0 + 30 * DAY),
      });
    }
  }

  it("sets the time and revokes every live refresh token of that user only", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    const other = await make("o@example.com");
    await tokens(user.id, 3);
    await tokens(other.id, 1);
    const result = await blockUser(a, user.id, T1);
    expect(result).toEqual({ blockedAt: T1.toISOString() });
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toEqual(T1);
    const mine = await getDb().RefreshToken.findAll({ where: { userId: user.id } });
    expect(mine.every((t) => t.revokedAt?.getTime() === T1.getTime())).toBe(true);
    const theirs = await getDb().RefreshToken.findAll({ where: { userId: other.id } });
    expect(theirs.every((t) => t.revokedAt === null)).toBe(true);
  });

  it("keeps the first time when blocked again, and still revokes live tokens", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    await blockUser(a, user.id, T1);
    await tokens(user.id, 1);
    const again = await blockUser(a, user.id, T2);
    expect(again).toEqual({ blockedAt: T1.toISOString() });
    expect((await getDb().RefreshToken.findAll({ where: { userId: user.id } }))[0].revokedAt).toEqual(T2);
  });

  it("refuses to block an admin and changes nothing", async () => {
    const a = await admin();
    const other = await make("a2@example.com", { role: "admin" });
    await tokens(other.id, 1);
    for (const id of [other.id, a.id]) {
      await expect(blockUser(a, id, T1)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await getDb().User.findByPk(other.id))!.blockedAt).toBeNull();
    expect((await getDb().RefreshToken.findAll())[0].revokedAt).toBeNull();
  });

  it("is for the admin only", async () => {
    const student = await make("s@example.com");
    const user = await make("u@example.com");
    for (const fn of [blockUser, unblockUser]) {
      await expect(fn({ id: student.id, role: "student" }, user.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(fn(null, user.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toBeNull();
  });

  it("treats a malformed or unknown id as not found", async () => {
    const a = await admin();
    for (const fn of [blockUser, unblockUser]) {
      await expect(fn(a, "nope")).rejects.toBeInstanceOf(NotFoundError);
      await expect(fn(a, "33333333-3333-4333-8333-333333333333")).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("unblocks, and unblocking twice is harmless", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    await blockUser(a, user.id, T1);
    expect(await unblockUser(a, user.id, T2)).toEqual({ blockedAt: null });
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toBeNull();
    expect(await unblockUser(a, user.id, T2)).toEqual({ blockedAt: null });
  });

  it("shows blockedAt in the list and detail, and filters by it", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    await make("v@example.com");
    await blockUser(a, user.id, T1);
    const all = await listUsers(a);
    expect(all.items.find((u) => u.id === user.id)!.blockedAt).toBe(T1.toISOString());
    expect(all.items.filter((u) => u.blockedAt === null)).toHaveLength(2);
    const only = await listUsers(a, { blocked: true });
    expect(only.items.map((u) => u.email)).toEqual(["u@example.com"]);
    expect(only.total).toBe(1);
    expect((await getUserDetail(a, user.id)).blockedAt).toBe(T1.toISOString());
  });
});

describe("deleteUser", () => {
  const UNKNOWN = "33333333-3333-4333-8333-333333333333";

  async function fill(userId: string, n: number) {
    const { Course, Resource, Bookmark, Completion, Todo, Milestone, StudyDay, RefreshToken, EmailConfirmation } = getDb();
    const course = await Course.create({ code: `TEST30${n}`, title: "Course", semester: 3 });
    const file = await Resource.create({ courseId: course.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
    await Bookmark.create({ userId, resourceId: file.id });
    await Completion.create({ userId, resourceId: file.id });
    await Todo.create({ userId, status: "todo", position: 0, title: "c" });
    await Milestone.create({ userId, key: "first_file" });
    await StudyDay.create({ userId, day: "2026-10-29" });
    await RefreshToken.create({
      userId,
      tokenHash: hashToken(`${userId}`.padEnd(43, "x")),
      familyId: `00000000-0000-4000-8000-00000000000${n}`,
      expiresAt: new Date(T0 + 30 * DAY),
    });
    await EmailConfirmation.create({ userId, tokenHash: hashToken(`c${userId}`.padEnd(43, "y")), expiresAt: new Date(T0 + DAY) });
    return file.id;
  }

  const counts = async (userId: string) => {
    const db = getDb();
    const where = { userId };
    return [
      await db.Bookmark.count({ where }),
      await db.Completion.count({ where }),
      await db.Todo.count({ where }),
      await db.Milestone.count({ where }),
      await db.StudyDay.count({ where }),
      await db.RefreshToken.count({ where }),
      await db.EmailConfirmation.count({ where }),
    ];
  };

  it("removes the user and every row that belongs to them, and only theirs", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    const other = await make("o@example.com");
    await fill(user.id, 1);
    await fill(other.id, 2);
    expect(await counts(user.id)).toEqual([1, 1, 1, 1, 1, 1, 1]);

    await deleteUser(a, user.id);

    expect(await getDb().User.findByPk(user.id)).toBeNull();
    expect(await counts(user.id)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await counts(other.id)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(await getDb().User.findByPk(other.id)).not.toBeNull();
    expect(await getDb().Resource.count()).toBe(2);
  });

  it("removes pending email jobs to that address only", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    const { EmailJob } = getDb();
    await EmailJob.create({ kind: "confirm-email", toEmail: "u@example.com" });
    await EmailJob.create({ kind: "already-registered", toEmail: "u@example.com" });
    await EmailJob.create({ kind: "confirm-email", toEmail: "u@example.com", status: "sent", sentAt: new Date(T0) });
    await EmailJob.create({ kind: "confirm-email", toEmail: "o@example.com" });

    await deleteUser(a, user.id);

    const left = await EmailJob.findAll({ order: [["toEmail", "ASC"]] });
    expect(left.map((j) => [j.toEmail, j.status])).toEqual([
      ["o@example.com", "pending"],
      ["u@example.com", "sent"],
    ]);
  });

  it("refuses an admin account and deletes nothing", async () => {
    const a = await admin();
    const other = await make("a2@example.com", { role: "admin" });
    for (const id of [other.id, a.id]) {
      await expect(deleteUser(a, id)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await getDb().User.count()).toBe(2);
  });

  it("is for the admin only", async () => {
    const student = await make("s@example.com");
    const user = await make("u@example.com");
    await expect(deleteUser({ id: student.id, role: "student" }, user.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteUser(null, user.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getDb().User.count()).toBe(2);
  });

  it("treats a malformed or unknown id, or a second delete, as not found", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    await expect(deleteUser(a, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteUser(a, UNKNOWN)).rejects.toBeInstanceOf(NotFoundError);
    await deleteUser(a, user.id);
    await expect(deleteUser(a, user.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets the same address sign up again afterwards", async () => {
    const a = await admin();
    const user = await make("u@example.com");
    await deleteUser(a, user.id);
    await signUp({ email: "u@example.com", password: "a-long-enough-password", ip: "203.0.113.1" });
    const again = await getDb().User.findOne({ where: { email: "u@example.com" } });
    expect(again).not.toBeNull();
    expect(again!.id).not.toBe(user.id);
    expect(again!.emailConfirmedAt).toBeNull();
  });
});
