import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { POST as block } from "./route";
import { POST as unblock } from "../unblock/route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));

const ORIGIN = "http://localhost:3210";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

const call = (handler: typeof block, action: string, id: string, headers: Record<string, string> = { origin: ORIGIN }) =>
  handler(new NextRequest(`${ORIGIN}/api/v1/users/${id}/${action}`, { method: "POST", headers }), {
    params: Promise.resolve({ id }),
  });
const postBlock = (id: string, headers?: Record<string, string>) => call(block, "block", id, headers);
const postUnblock = (id: string, headers?: Record<string, string>) => call(unblock, "unblock", id, headers);

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

const make = (email: string, role: "admin" | "student") =>
  getDb().User.create({ email, passwordHash: "x", role, emailConfirmedAt: new Date() });

describe("POST /api/v1/users/ID/block and unblock", () => {
  it("lets the admin block (twice, same time) and unblock a user", async () => {
    const admin = await make("a@example.com", "admin");
    const user = await make("u@example.com", "student");
    await getDb().RefreshToken.create({
      userId: user.id,
      tokenHash: "a".repeat(64),
      familyId: "00000000-0000-4000-8000-000000000001",
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    session.viewer = { id: admin.id, role: "admin" };

    const first = await postBlock(user.id);
    expect(first.status).toBe(200);
    const { blockedAt } = await first.json();
    expect((await getDb().User.findByPk(user.id))!.blockedAt?.toISOString()).toBe(blockedAt);
    expect((await getDb().RefreshToken.findAll())[0].revokedAt).not.toBeNull();

    const second = await postBlock(user.id);
    expect(second.status).toBe(200);
    expect((await second.json()).blockedAt).toBe(blockedAt);

    const undone = await postUnblock(user.id);
    expect(undone.status).toBe(200);
    expect(await undone.json()).toEqual({ blockedAt: null });
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toBeNull();
  });

  it("refuses to block an admin, even the caller, with 403", async () => {
    const admin = await make("a@example.com", "admin");
    const other = await make("a2@example.com", "admin");
    session.viewer = { id: admin.id, role: "admin" };
    expect((await postBlock(other.id)).status).toBe(403);
    expect((await postBlock(admin.id)).status).toBe(403);
    expect((await getDb().User.findAll()).every((u) => u.blockedAt === null)).toBe(true);
  });

  it("refuses a student with 403 and changes nothing", async () => {
    const student = await make("s@example.com", "student");
    const user = await make("u@example.com", "student");
    session.viewer = { id: student.id, role: "student" };
    expect((await postBlock(user.id)).status).toBe(403);
    expect((await postUnblock(user.id)).status).toBe(403);
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toBeNull();
  });

  it("answers 401 when signed out", async () => {
    const user = await make("u@example.com", "student");
    expect((await postBlock(user.id)).status).toBe(401);
    expect((await postUnblock(user.id)).status).toBe(401);
  });

  it("answers 404 for an unknown id", async () => {
    const admin = await make("a@example.com", "admin");
    session.viewer = { id: admin.id, role: "admin" };
    expect((await postBlock(UNKNOWN)).status).toBe(404);
    expect((await postUnblock(UNKNOWN)).status).toBe(404);
  });

  it("refuses a cross-origin or origin-less request with 403", async () => {
    const admin = await make("a@example.com", "admin");
    const user = await make("u@example.com", "student");
    session.viewer = { id: admin.id, role: "admin" };
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
    for (const headers of refused) {
      expect((await postBlock(user.id, headers)).status).toBe(403);
    }
    expect((await getDb().User.findByPk(user.id))!.blockedAt).toBeNull();
  });
});
