import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { DELETE, PATCH } from "./[lecturerId]/route";
import { GET, POST } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));

const ORIGIN = "http://localhost:3210";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

const get = () => GET(new NextRequest(`${ORIGIN}/api/v1/lecturers`));
const post = (body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  POST(new NextRequest(`${ORIGIN}/api/v1/lecturers`, { method: "POST", headers, body: JSON.stringify(body) }));
const item = (method: "PATCH" | "DELETE", id: string, body?: unknown) =>
  (method === "PATCH" ? PATCH : DELETE)(
    new NextRequest(`${ORIGIN}/api/v1/lecturers/${id}`, { method, headers: { origin: ORIGIN }, body: body === undefined ? undefined : JSON.stringify(body) }),
    { params: Promise.resolve({ lecturerId: id }) },
  );

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function signInAs(role: "admin" | "student") {
  const user = await getDb().User.create({ email: `${role}@example.com`, passwordHash: "x", role, emailConfirmedAt: new Date() });
  session.viewer = { id: user.id, role };
}

describe("GET /api/v1/lecturers", () => {
  it("lists lecturers with file counts (200), admin only", async () => {
    await signInAs("admin");
    await post({ name: "Dr. Ali Ghorayeb" });
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).lecturers).toEqual([
      { id: expect.any(String), name: "Dr. Ali Ghorayeb", slug: "ali-ghorayeb", fileCount: 0 },
    ]);
  });

  it("answers 403 for a student and 401 signed out", async () => {
    await signInAs("student");
    expect((await get()).status).toBe(403);
    session.viewer = null;
    expect((await get()).status).toBe(401);
  });
});

describe("POST /api/v1/lecturers", () => {
  it("creates a lecturer with a slug (201)", async () => {
    await signInAs("admin");
    const response = await post({ name: "  Pr. Élie  Haddad " });
    expect(response.status).toBe(201);
    expect((await response.json()).lecturer).toEqual({ id: expect.any(String), name: "Pr. Élie Haddad", slug: "elie-haddad" });
  });

  it("answers 400 with the field names and 409 name_taken", async () => {
    await signInAs("admin");
    const bad = await post({ name: "   " });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Invalid input", fields: ["name"] });
    expect((await post("nope")).status).toBe(400);
    await post({ name: "Ali One" });
    const taken = await post({ name: "ali one" });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "name_taken" });
  });

  it("answers 403 for a student, 401 signed out, 403 cross-origin", async () => {
    await signInAs("student");
    expect((await post({ name: "X" })).status).toBe(403);
    session.viewer = null;
    expect((await post({ name: "X" })).status).toBe(401);
    await signInAs("admin");
    expect((await post({ name: "X" }, { origin: "https://evil.example" })).status).toBe(403);
    expect(await getDb().Lecturer.count()).toBe(0);
  });
});

describe("PATCH /api/v1/lecturers/ID", () => {
  it("renames and keeps the slug (200)", async () => {
    await signInAs("admin");
    const { lecturer } = await (await post({ name: "Ali One" })).json();
    const response = await item("PATCH", lecturer.id, { name: "Dr. Ali One" });
    expect(response.status).toBe(200);
    expect((await response.json()).lecturer).toEqual({ id: lecturer.id, name: "Dr. Ali One", slug: "ali-one" });
  });

  it("answers 409, 400, 404, 403 and 401 where due", async () => {
    await signInAs("admin");
    const one = (await (await post({ name: "Ali One" })).json()).lecturer;
    await post({ name: "Sara Two" });
    expect((await item("PATCH", one.id, { name: "sara two" })).status).toBe(409);
    expect((await item("PATCH", one.id, { name: "" })).status).toBe(400);
    expect((await item("PATCH", UNKNOWN, { name: "x" })).status).toBe(404);
    expect((await item("PATCH", "not-an-id", { name: "x" })).status).toBe(404);
    await signInAs("student");
    expect((await item("PATCH", one.id, { name: "x" })).status).toBe(403);
    session.viewer = null;
    expect((await item("PATCH", one.id, { name: "x" })).status).toBe(401);
  });
});

describe("DELETE /api/v1/lecturers/ID", () => {
  it("deletes an unused lecturer (204)", async () => {
    await signInAs("admin");
    const { lecturer } = await (await post({ name: "Ali One" })).json();
    expect((await item("DELETE", lecturer.id)).status).toBe(204);
    expect(await getDb().Lecturer.count()).toBe(0);
  });

  it("answers 409 lecturer_in_use with the count while a file uses it", async () => {
    await signInAs("admin");
    const { lecturer } = await (await post({ name: "Ali One" })).json();
    const course = await getDb().Course.create({ code: "DEMO301", title: "Demo", semester: 3 });
    await getDb().Resource.create({ courseId: course.id, type: "lecture", title: "Draft", language: "en", lecturerId: lecturer.id });
    const response = await item("DELETE", lecturer.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "lecturer_in_use", fileCount: 1 });
    expect(await getDb().Lecturer.count()).toBe(1);
  });

  it("answers 404, 403 and 401 where due", async () => {
    await signInAs("admin");
    expect((await item("DELETE", UNKNOWN)).status).toBe(404);
    await signInAs("student");
    expect((await item("DELETE", UNKNOWN)).status).toBe(403);
    session.viewer = null;
    expect((await item("DELETE", UNKNOWN)).status).toBe(401);
  });
});
