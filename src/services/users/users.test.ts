import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { listUsers } from "./users";

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
