import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { POST } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));

const ORIGIN = "http://localhost:3210";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

const post = (id: string, headers: Record<string, string> = { origin: ORIGIN }) =>
  POST(new NextRequest(`${ORIGIN}/api/v1/users/${id}/confirm-email`, { method: "POST", headers }), {
    params: Promise.resolve({ id }),
  });

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function make(email: string, role: "admin" | "student", confirmed: boolean) {
  return getDb().User.create({ email, passwordHash: "x", role, emailConfirmedAt: confirmed ? new Date() : null });
}

describe("POST /api/v1/users/ID/confirm-email", () => {
  it("lets the admin confirm a user, twice with the same time", async () => {
    const admin = await make("a@example.com", "admin", true);
    const user = await make("u@example.com", "student", false);
    session.viewer = { id: admin.id, role: "admin" };

    const first = await post(user.id);
    expect(first.status).toBe(200);
    const { emailConfirmedAt } = await first.json();
    expect((await getDb().User.findByPk(user.id))!.emailConfirmedAt?.toISOString()).toBe(emailConfirmedAt);

    const second = await post(user.id);
    expect(second.status).toBe(200);
    expect((await second.json()).emailConfirmedAt).toBe(emailConfirmedAt);
  });

  it("refuses a student with 403 and changes nothing", async () => {
    const student = await make("s@example.com", "student", true);
    const user = await make("u@example.com", "student", false);
    session.viewer = { id: student.id, role: "student" };
    expect((await post(user.id)).status).toBe(403);
    expect((await getDb().User.findByPk(user.id))!.emailConfirmedAt).toBeNull();
  });

  it("answers 401 when signed out", async () => {
    const user = await make("u@example.com", "student", false);
    expect((await post(user.id)).status).toBe(401);
  });

  it("answers 404 for an unknown id", async () => {
    const admin = await make("a@example.com", "admin", true);
    session.viewer = { id: admin.id, role: "admin" };
    expect((await post(UNKNOWN)).status).toBe(404);
  });

  it("refuses a cross-origin or origin-less request with 403", async () => {
    const admin = await make("a@example.com", "admin", true);
    const user = await make("u@example.com", "student", false);
    session.viewer = { id: admin.id, role: "admin" };
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
    for (const headers of refused) {
      expect((await post(user.id, headers)).status).toBe(403);
    }
    expect((await getDb().User.findByPk(user.id))!.emailConfirmedAt).toBeNull();
  });
});
