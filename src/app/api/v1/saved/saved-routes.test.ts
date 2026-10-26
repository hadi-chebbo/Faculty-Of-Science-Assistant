import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { DELETE, PUT } from "./[resourceId]/route";
import { GET as listIds } from "./ids/route";
import { GET as listSaved } from "./route";

// The session cookie is read through next/headers, which needs a real request; the tests set who
// is signed in directly.
const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
// connection() only works inside a real request.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const ORIGIN = "http://localhost:3210";
const MISSING_ID = "33333333-3333-4333-8333-333333333333";

function call(method: string, id: string, headers: Record<string, string> = { origin: ORIGIN }) {
  const request = new NextRequest(`${ORIGIN}/api/v1/saved/${id}`, { method, headers });
  const ctx = { params: Promise.resolve({ resourceId: id }) } as never;
  return (method === "PUT" ? PUT : DELETE)(request, ctx);
}

const ids = () => listIds();

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function seed() {
  const { User, Course, Resource } = getDb();
  const user = await User.create({ email: "s@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const published = await Resource.create({ courseId: course.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
  const draft = await Resource.create({ courseId: course.id, type: "lecture", title: "D", fileKey: "k" });
  session.viewer = { id: user.id, role: "student" };
  return { user, published, draft };
}

describe("saved routes", () => {
  it("answer 401 when nobody is signed in", async () => {
    const { published } = await seed();
    session.viewer = null;
    for (const response of [await call("PUT", published.id), await call("DELETE", published.id), await ids(), await listSaved()]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Not signed in" });
    }
  });

  it("answer 401 when the signed-in user no longer exists", async () => {
    await seed();
    session.viewer = { id: MISSING_ID, role: "student" };
    expect((await ids()).status).toBe(401);
  });

  it("refuse a cross-origin or origin-less write with 403", async () => {
    const { published } = await seed();
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
    for (const headers of refused) {
      expect((await call("PUT", published.id, headers)).status).toBe(403);
      expect((await call("DELETE", published.id, headers)).status).toBe(403);
    }
    expect(await getDb().Bookmark.count()).toBe(0);
  });

  it("answer 404 for a draft and for an unknown id when saving", async () => {
    const { draft } = await seed();
    for (const id of [draft.id, MISSING_ID, "nope"]) {
      const response = await call("PUT", id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Resource not found" });
    }
  });

  it("list the saved resources grouped by course", async () => {
    const { published } = await seed();
    await call("PUT", published.id);
    const response = await listSaved();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      courses: { courseCode: string; semester: number; items: { id: string; title: string }[] }[];
    };
    expect(body.courses).toHaveLength(1);
    expect(body.courses[0]).toMatchObject({ courseCode: "TEST301", semester: 3 });
    expect(body.courses[0].items.map((item) => [item.id, item.title])).toEqual([[published.id, "A"]]);
  });

  it("answer 204 with no body for save and unsave, twice each, and list the ids", async () => {
    const { published } = await seed();
    expect(await (await ids()).json()).toEqual({ ids: [] });
    for (let i = 0; i < 2; i++) {
      const saved = await call("PUT", published.id);
      expect(saved.status).toBe(204);
      expect(await saved.text()).toBe("");
      expect(saved.headers.get("cache-control")).toBe("no-store");
    }
    const listed = await ids();
    expect(listed.status).toBe(200);
    expect(listed.headers.get("cache-control")).toBe("no-store");
    expect(await listed.json()).toEqual({ ids: [published.id] });
    for (let i = 0; i < 2; i++) expect((await call("DELETE", published.id)).status).toBe(204);
    expect(await (await ids()).json()).toEqual({ ids: [] });
  });
});
