import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { GET } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const call = (code: string) =>
  GET(new Request(`http://localhost:3210/api/v1/progress/courses/${code}`), { params: Promise.resolve({ code }) } as never);

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

describe("GET /api/v1/progress/courses/CODE", () => {
  it("answers 401 when nobody is signed in", async () => {
    const response = await call("TEST301");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 for an unknown code", async () => {
    const user = await getDb().User.create({ email: "s@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    session.viewer = { id: user.id, role: "student" };
    expect((await call("NOPE")).status).toBe(404);
  });

  it("answers 200 with the course progress", async () => {
    const { User, Course, Chapter, Resource, Completion } = getDb();
    const user = await User.create({ email: "s@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
    const chapter = await Chapter.create({ courseId: course.id, position: 1, title: "Basics" });
    const lecture = await Resource.create({ courseId: course.id, chapterId: chapter.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
    await Resource.create({ courseId: course.id, type: "notes", title: "N", fileKey: "k", isPublished: true });
    await Completion.create({ userId: user.id, resourceId: lecture.id });
    session.viewer = { id: user.id, role: "student" };
    const response = await call("TEST301");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      course: { code: "TEST301", title: "Course A", done: 1, total: 2, finished: false },
      exams: { done: 0, total: 0 },
      chapters: [{ id: chapter.id, position: 1, title: "Basics", done: 1, total: 1, finished: true }],
      general: { done: 0, total: 1, finished: false },
    });
  });
});
