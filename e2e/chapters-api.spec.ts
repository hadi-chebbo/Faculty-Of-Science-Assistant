import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin, like resources-api.spec.ts. These tests write chapters, and a
// course that gains a chapter changes its public page layout, so they all use DEMO602: it has no
// chapters and no resources, and no other spec opens its page. Every test removes the chapters it
// created, so the course ends with none. The writing tests share that one course and depend on
// positions, so they run serially and only in the desktop project (the mobile project would run
// them in another worker at the same time); the rejection tests write nothing and run in both.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STUDENT_EMAIL = "demo.student@example.com"; // from the demo seed
const STUDENT_PASSWORD = "demo-student-password";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

// Test-only database access: no endpoint returns a course id, and cleanup must work even when the
// API call under test failed.
async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const demoCourseId = async () => (await query<{ id: string }>("SELECT id FROM courses WHERE code = 'DEMO602'"))[0].id;
const countByTitle = async (title: string) =>
  (await query<{ n: number }>("SELECT count(*)::int AS n FROM chapters WHERE title = $1", [title]))[0].n;
// Removes every chapter this spec could have left in the course (all titles start with "E2E chapter").
const removeE2eChapters = (courseId: string) =>
  query("DELETE FROM chapters WHERE course_id = $1 AND title LIKE 'E2E chapter%'", [courseId]);

const octet = () => randomBytes(1)[0];
const uniqueTitle = () => `E2E chapter ${randomBytes(4).toString("hex")}`;

async function signIn(request: APIRequestContext, origin: string, email: string, password: string) {
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

type Chapter = { id: string; position: number; title: string };

test.describe("chapter write API: rejections", () => {
  let courseId: string;
  let origin: string;

  test.beforeAll(async () => {
    courseId = await demoCourseId();
  });

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  // All four routes with the given headers.
  function allFour(request: APIRequestContext, headers: Record<string, string>, title: string) {
    const id = randomUUID();
    return Promise.all([
      request.post(`/api/v1/courses/${courseId}/chapters`, { headers, data: { title } }),
      request.put(`/api/v1/courses/${courseId}/chapters/order`, { headers, data: { chapterIds: [] } }),
      request.put(`/api/v1/chapters/${id}`, { headers, data: { title } }),
      request.delete(`/api/v1/chapters/${id}`, { headers }),
    ]);
  }

  test("anonymous callers get 401 on all four", async ({ request }) => {
    const title = uniqueTitle();
    for (const response of await allFour(request, { origin }, title)) {
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Not signed in" });
    }
    expect(await countByTitle(title)).toBe(0);
  });

  test("a signed-in student gets 403 on all four and writes nothing", async ({ request }) => {
    await signIn(request, origin, STUDENT_EMAIL, STUDENT_PASSWORD);
    const title = uniqueTitle();
    for (const response of await allFour(request, { origin }, title)) {
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
    }
    expect(await countByTitle(title)).toBe(0);
  });

  test("a foreign origin, or none, is refused even with admin cookies", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const title = uniqueTitle();
    const attempts: Array<Record<string, string>> = [{ origin: "https://evil.example" }, {}];
    for (const headers of attempts) {
      for (const response of await allFour(request, headers, title)) {
        expect(response.status(), JSON.stringify(headers)).toBe(403);
        expect(response.headers()["cache-control"]).toBe("no-store");
      }
    }
    expect(await countByTitle(title)).toBe(0);
  });
});

test.describe("chapter write API: admin", () => {
  test.describe.configure({ mode: "serial" });

  let courseId: string;
  let origin: string;

  test.beforeAll(async () => {
    courseId = await demoCourseId();
  });

  test.beforeEach(({ baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "writes to one shared course; desktop project only");
    origin = new URL(baseURL!).origin;
  });

  const create = (request: APIRequestContext, title: string) =>
    request.post(`/api/v1/courses/${courseId}/chapters`, { headers: { origin }, data: { title } });

  test("an admin can create, rename, reorder and delete chapters", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    const titleA = uniqueTitle();
    const titleB = uniqueTitle();
    try {
      const first = await create(request, titleA);
      expect(first.status()).toBe(201);
      expect(first.headers()["cache-control"]).toBe("no-store");
      const firstBody = (await first.json()) as { chapters: Chapter[] };
      expect(firstBody.chapters).toEqual([{ id: expect.any(String), position: 1, title: titleA }]);
      const idA = firstBody.chapters[0].id;

      const second = await create(request, titleB);
      expect(second.status()).toBe(201);
      const secondBody = (await second.json()) as { chapters: Chapter[] };
      expect(secondBody.chapters).toEqual([
        { id: idA, position: 1, title: titleA },
        { id: expect.any(String), position: 2, title: titleB },
      ]);
      const idB = secondBody.chapters[1].id;

      const renamed = `${titleA} renamed`;
      const put = await request.put(`/api/v1/chapters/${idA}`, { headers, data: { title: renamed } });
      expect(put.status()).toBe(200);
      expect(put.headers()["cache-control"]).toBe("no-store");
      expect((await put.json()).chapters).toEqual([
        { id: idA, position: 1, title: renamed },
        { id: idB, position: 2, title: titleB },
      ]);

      const order = await request.put(`/api/v1/courses/${courseId}/chapters/order`, {
        headers,
        data: { chapterIds: [idB, idA] },
      });
      expect(order.status()).toBe(200);
      expect(order.headers()["cache-control"]).toBe("no-store");
      expect((await order.json()).chapters).toEqual([
        { id: idB, position: 1, title: titleB },
        { id: idA, position: 2, title: renamed },
      ]);

      const del = await request.delete(`/api/v1/chapters/${idB}`, { headers });
      expect(del.status()).toBe(200);
      expect(del.headers()["cache-control"]).toBe("no-store");
      expect((await del.json()).chapters).toEqual([{ id: idA, position: 1, title: renamed }]);
    } finally {
      await removeE2eChapters(courseId);
    }
  });

  test("invalid input is a 400 that names the fields", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    try {
      const blank = await create(request, "   ");
      expect(blank.status()).toBe(400);
      expect(blank.headers()["cache-control"]).toBe("no-store");
      expect(await blank.json()).toEqual({ error: "Invalid input", fields: ["title"] });

      const made = await create(request, uniqueTitle());
      expect(made.status()).toBe(201);
      const { chapters } = (await made.json()) as { chapters: Chapter[] };

      const blankRename = await request.put(`/api/v1/chapters/${chapters[0].id}`, { headers, data: { title: "" } });
      expect(blankRename.status()).toBe(400);
      expect((await blankRename.json()).fields).toEqual(["title"]);

      for (const chapterIds of [[], [chapters[0].id, chapters[0].id], [randomUUID()], "nope"]) {
        const order = await request.put(`/api/v1/courses/${courseId}/chapters/order`, { headers, data: { chapterIds } });
        expect(order.status(), JSON.stringify(chapterIds)).toBe(400);
        expect(await order.json()).toEqual({ error: "Invalid input", fields: ["chapterIds"] });
      }

      const urls: Array<[string, string]> = [
        ["post", `/api/v1/courses/${courseId}/chapters`],
        ["put", `/api/v1/courses/${courseId}/chapters/order`],
        ["put", `/api/v1/chapters/${chapters[0].id}`],
      ];
      for (const [method, url] of urls) {
        const notJson = await request.fetch(url, {
          method,
          headers: { ...headers, "content-type": "application/json" },
          data: "this is not json",
        });
        expect(notJson.status(), url).toBe(400);
        expect(await notJson.json()).toEqual({ error: "Invalid request" });
        const notObject = await request.fetch(url, { method, headers, data: [1, 2] });
        expect(notObject.status(), url).toBe(400);
        expect(await notObject.json()).toEqual({ error: "Invalid request" });
      }
    } finally {
      await removeE2eChapters(courseId);
    }
  });

  test("an unknown or malformed id is a 404", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    try {
      for (const id of [randomUUID(), "not-a-uuid"]) {
        const post = await request.post(`/api/v1/courses/${id}/chapters`, { headers, data: { title: uniqueTitle() } });
        expect(post.status(), id).toBe(404);
        expect(await post.json()).toEqual({ error: "Course not found" });

        const order = await request.put(`/api/v1/courses/${id}/chapters/order`, { headers, data: { chapterIds: [] } });
        expect(order.status(), id).toBe(404);
        expect(await order.json()).toEqual({ error: "Course not found" });

        const put = await request.put(`/api/v1/chapters/${id}`, { headers, data: { title: uniqueTitle() } });
        expect(put.status(), id).toBe(404);
        expect(await put.json()).toEqual({ error: "Chapter not found" });

        const del = await request.delete(`/api/v1/chapters/${id}`, { headers });
        expect(del.status(), id).toBe(404);
        expect(await del.json()).toEqual({ error: "Chapter not found" });
      }
    } finally {
      await removeE2eChapters(courseId);
    }
  });
});
