import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { DELETE, PUT } from "./[resourceId]/route";
import { GET as listIds } from "./ids/route";

// The session cookie is read through next/headers, which needs a real request; the tests set who
// is signed in directly.
const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
// connection() only works inside a real request.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const ORIGIN = "http://localhost:3210";
const MISSING_ID = "33333333-3333-4333-8333-333333333333";

function call(method: "PUT" | "DELETE", id: string, headers: Record<string, string> = { origin: ORIGIN }) {
  const request = new NextRequest(`${ORIGIN}/api/v1/completions/${id}`, { method, headers });
  const ctx = { params: Promise.resolve({ resourceId: id }) } as never;
  return (method === "PUT" ? PUT : DELETE)(request, ctx);
}

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function seed() {
  const { User, Course, Chapter, Resource } = getDb();
  const user = await User.create({ email: "s@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const chapter = await Chapter.create({ courseId: course.id, position: 2, title: "Sorting" });
  const lecture = await Resource.create({ courseId: course.id, chapterId: chapter.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
  const draft = await Resource.create({ courseId: course.id, type: "lecture", title: "D", fileKey: "k" });
  const solution = await Resource.create({ courseId: course.id, type: "solution", title: "S", fileKey: "k", isPublished: true });
  session.viewer = { id: user.id, role: "student" };
  return { user, chapter, lecture, draft, solution };
}

describe("completion routes", () => {
  it("answer 401 when nobody is signed in", async () => {
    const { lecture } = await seed();
    session.viewer = null;
    for (const response of [await call("PUT", lecture.id), await call("DELETE", lecture.id), await listIds()]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Not signed in" });
    }
    expect(await getDb().Completion.count()).toBe(0);
  });

  it("refuse a cross-origin or origin-less write with 403", async () => {
    const { lecture } = await seed();
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
    for (const headers of refused) {
      expect((await call("PUT", lecture.id, headers)).status).toBe(403);
      expect((await call("DELETE", lecture.id, headers)).status).toBe(403);
    }
    expect(await getDb().Completion.count()).toBe(0);
  });

  it("answer 404 when marking a draft, a solution, or an unknown id", async () => {
    const { draft, solution } = await seed();
    for (const id of [draft.id, solution.id, MISSING_ID, "nope"]) {
      const response = await call("PUT", id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Resource not found" });
    }
  });

  it("mark with the progress, twice, list the ids, and un-mark", async () => {
    const { lecture, chapter } = await seed();
    expect(await (await listIds()).json()).toEqual({ ids: [] });

    const first = await call("PUT", lecture.id);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({
      created: true,
      progress: {
        course: { code: "TEST301", done: 1, total: 1, finished: true },
        exams: { done: 0, total: 0 },
        chapter: { id: chapter.id, position: 2, title: "Sorting", done: 1, total: 1, finished: true },
      },
    });
    expect(await (await call("PUT", lecture.id)).json()).toMatchObject({ created: false });

    const listed = await listIds();
    expect(listed.status).toBe(200);
    expect(listed.headers.get("cache-control")).toBe("no-store");
    expect(await listed.json()).toEqual({ ids: [lecture.id] });

    for (let i = 0; i < 2; i++) {
      const removed = await call("DELETE", lecture.id);
      expect(removed.status).toBe(200);
      expect(await removed.json()).toMatchObject({ progress: { course: { done: 0, total: 1 }, chapter: { done: 0 } } });
    }
    expect(await (await listIds()).json()).toEqual({ ids: [] });
  });
});
