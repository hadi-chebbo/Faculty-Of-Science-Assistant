import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { PATCH } from "./[courseId]/route";
import { POST } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));

const ORIGIN = "http://localhost:3210";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

const post = (body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  POST(new NextRequest(`${ORIGIN}/api/v1/courses`, { method: "POST", headers, body: JSON.stringify(body) }));
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(`${ORIGIN}/api/v1/courses/${id}`, { method: "PATCH", headers: { origin: ORIGIN }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ courseId: id }),
  });

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function signInAs(role: "admin" | "student") {
  const user = await getDb().User.create({ email: `${role}@example.com`, passwordHash: "x", role, emailConfirmedAt: new Date() });
  session.viewer = { id: user.id, role };
}

describe("POST /api/v1/courses", () => {
  it("creates a course with a normalised code (201)", async () => {
    await signInAs("admin");
    const response = await post({ code: " i3 301 ", title: "Algorithms", semester: 3 });
    expect(response.status).toBe(201);
    const { course } = await response.json();
    expect(course).toMatchObject({ code: "I3301", title: "Algorithms", semester: 3 });
    expect(course.id).toEqual(expect.any(String));
  });

  it("answers 400 with the field names", async () => {
    await signInAs("admin");
    for (const code of ["I3-301", "A"]) {
      const response = await post({ code, title: "T", semester: 3 });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid input", fields: ["code"] });
    }
    expect((await post("nope")).status).toBe(400);
  });

  it("answers 409 code_taken for a duplicate in any case", async () => {
    await signInAs("admin");
    await post({ code: "DEMO301", title: "One", semester: 3 });
    const response = await post({ code: "demo 301", title: "Two", semester: 3 });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "code_taken" });
  });

  it("answers 403 for a student, 401 signed out, 403 cross-origin", async () => {
    await signInAs("student");
    expect((await post({ code: "AB", title: "T", semester: 3 })).status).toBe(403);
    session.viewer = null;
    expect((await post({ code: "AB", title: "T", semester: 3 })).status).toBe(401);
    await signInAs("admin");
    expect((await post({ code: "AB", title: "T", semester: 3 }, { origin: "https://evil.example" })).status).toBe(403);
    expect(await getDb().Course.count()).toBe(0);
  });
});

describe("PATCH /api/v1/courses/ID", () => {
  it("changes the course (200)", async () => {
    await signInAs("admin");
    const course = await getDb().Course.create({ code: "OLD1", title: "Old", semester: 3 });
    const response = await patch(course.id, { code: "new 1", semester: 4 });
    expect(response.status).toBe(200);
    expect((await response.json()).course).toMatchObject({ id: course.id, code: "NEW1", title: "Old", semester: 4 });
  });

  it("answers 409, 400, 404 and 403 where due", async () => {
    await signInAs("admin");
    const one = await getDb().Course.create({ code: "ONE1", title: "One", semester: 3 });
    await getDb().Course.create({ code: "TWO2", title: "Two", semester: 3 });
    expect((await patch(one.id, { code: "two2" })).status).toBe(409);
    expect((await patch(one.id, { semester: 9 })).status).toBe(400);
    expect((await patch(UNKNOWN, { title: "x" })).status).toBe(404);
    expect((await patch("not-an-id", { title: "x" })).status).toBe(404);
    await signInAs("student");
    expect((await patch(one.id, { title: "x" })).status).toBe(403);
    session.viewer = null;
    expect((await patch(one.id, { title: "x" })).status).toBe(401);
  });
});
