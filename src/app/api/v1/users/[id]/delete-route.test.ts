import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { DELETE as remove } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));

const ORIGIN = "http://localhost:3210";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

const del = (id: string, headers: Record<string, string> = { origin: ORIGIN }) =>
  remove(new NextRequest(`${ORIGIN}/api/v1/users/${id}`, { method: "DELETE", headers }), {
    params: Promise.resolve({ id }),
  });

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

const make = (email: string, role: "admin" | "student") =>
  getDb().User.create({ email, passwordHash: "x", role, emailConfirmedAt: new Date() });

describe("DELETE /api/v1/users/ID", () => {
  it("lets the admin delete a user (204), then answers 404", async () => {
    const admin = await make("a@example.com", "admin");
    const user = await make("u@example.com", "student");
    session.viewer = { id: admin.id, role: "admin" };
    const first = await del(user.id);
    expect(first.status).toBe(204);
    expect(await getDb().User.findByPk(user.id)).toBeNull();
    expect((await del(user.id)).status).toBe(404);
  });

  it("refuses to delete an admin, even the caller, with 403", async () => {
    const admin = await make("a@example.com", "admin");
    const other = await make("a2@example.com", "admin");
    session.viewer = { id: admin.id, role: "admin" };
    expect((await del(other.id)).status).toBe(403);
    expect((await del(admin.id)).status).toBe(403);
    expect(await getDb().User.count()).toBe(2);
  });

  it("refuses a student with 403 and deletes nothing", async () => {
    const student = await make("s@example.com", "student");
    const user = await make("u@example.com", "student");
    session.viewer = { id: student.id, role: "student" };
    expect((await del(user.id)).status).toBe(403);
    expect(await getDb().User.count()).toBe(2);
  });

  it("answers 401 when signed out", async () => {
    const user = await make("u@example.com", "student");
    expect((await del(user.id)).status).toBe(401);
    expect(await getDb().User.findByPk(user.id)).not.toBeNull();
  });

  it("answers 404 for an unknown id", async () => {
    const admin = await make("a@example.com", "admin");
    session.viewer = { id: admin.id, role: "admin" };
    expect((await del(UNKNOWN)).status).toBe(404);
  });

  it("refuses a cross-origin or origin-less request with 403", async () => {
    const admin = await make("a@example.com", "admin");
    const user = await make("u@example.com", "student");
    session.viewer = { id: admin.id, role: "admin" };
    for (const headers of [{ origin: "https://evil.example" }, {}] as Record<string, string>[]) {
      expect((await del(user.id, headers)).status).toBe(403);
    }
    expect(await getDb().User.findByPk(user.id)).not.toBeNull();
  });
});
