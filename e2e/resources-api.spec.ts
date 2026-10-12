import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin, like auth.spec.ts. These tests only ever create DRAFTS titled
// "E2E draft ..." and delete them again, so the public pages never change while other specs run.
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

// Test-only lookup: no endpoint returns a course id.
async function demoCourseId(): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT id FROM courses WHERE code = 'DEMO301'");
    return result.rows[0].id as string;
  } finally {
    await client.end();
  }
}

async function countByTitle(title: string): Promise<number> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT count(*)::int AS n FROM resources WHERE title = $1", [title]);
    return result.rows[0].n as number;
  } finally {
    await client.end();
  }
}

const octet = () => randomBytes(1)[0];
const uniqueTitle = () => `E2E draft ${randomBytes(4).toString("hex")}`;

async function signIn(request: APIRequestContext, origin: string, email: string, password: string) {
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

const draft = (courseId: string, title: string) => ({ courseId, type: "lecture", title, isPublished: false });

test.describe("resource write API", () => {
  let courseId: string;
  let origin: string;

  test.beforeAll(async () => {
    courseId = await demoCourseId();
  });

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  // Deletes through the API as the signed-in admin; used in finally blocks.
  async function cleanup(request: APIRequestContext, ids: string[]) {
    for (const id of ids) await request.delete(`/api/v1/resources/${id}`, { headers: { origin } });
  }

  test("anonymous callers get 401 on all three", async ({ request }) => {
    const headers = { origin };
    const title = uniqueTitle();
    const post = await request.post("/api/v1/resources", { headers, data: draft(courseId, title) });
    const put = await request.put(`/api/v1/resources/${randomUUID()}`, { headers, data: draft(courseId, title) });
    const del = await request.delete(`/api/v1/resources/${randomUUID()}`, { headers });
    for (const response of [post, put, del]) {
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Not signed in" });
    }
    expect(await countByTitle(title)).toBe(0);
  });

  test("a signed-in student gets 403 on all three and creates nothing", async ({ request }) => {
    await signIn(request, origin, STUDENT_EMAIL, STUDENT_PASSWORD);
    const headers = { origin };
    const title = uniqueTitle();
    const post = await request.post("/api/v1/resources", { headers, data: draft(courseId, title) });
    const put = await request.put(`/api/v1/resources/${randomUUID()}`, { headers, data: draft(courseId, title) });
    const del = await request.delete(`/api/v1/resources/${randomUUID()}`, { headers });
    for (const response of [post, put, del]) {
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
    }
    expect(await countByTitle(title)).toBe(0);
  });

  test("a foreign origin, or none, is refused even with admin cookies", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const title = uniqueTitle();
    const id = randomUUID();
    const data = draft(courseId, title);
    const attempts: Array<Record<string, string>> = [{ origin: "https://evil.example" }, {}];
    for (const headers of attempts) {
      const responses = [
        await request.post("/api/v1/resources", { headers, data }),
        await request.put(`/api/v1/resources/${id}`, { headers, data }),
        await request.delete(`/api/v1/resources/${id}`, { headers }),
      ];
      for (const response of responses) {
        expect(response.status(), JSON.stringify(headers)).toBe(403);
        expect(response.headers()["cache-control"]).toBe("no-store");
      }
    }
    expect(await countByTitle(title)).toBe(0);
  });

  test("an admin can create, update and delete a draft", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    const created: string[] = [];
    try {
      const title = uniqueTitle();
      const post = await request.post("/api/v1/resources", { headers, data: draft(courseId, title) });
      expect(post.status()).toBe(201);
      expect(post.headers()["cache-control"]).toBe("no-store");
      const { resource } = await post.json();
      created.push(resource.id);
      expect(resource).toMatchObject({ title, type: "lecture", isPublished: false });

      const newTitle = `${title} edited`;
      const put = await request.put(`/api/v1/resources/${resource.id}`, {
        headers,
        data: { courseId, type: "notes", title: newTitle, description: "E2E draft description", language: "fr", isPublished: false },
      });
      expect(put.status()).toBe(200);
      expect(put.headers()["cache-control"]).toBe("no-store");
      expect((await put.json()).resource).toMatchObject({
        id: resource.id,
        title: newTitle,
        type: "notes",
        description: "E2E draft description",
        language: "fr",
        isPublished: false,
      });

      const del = await request.delete(`/api/v1/resources/${resource.id}`, { headers });
      expect(del.status()).toBe(204);
      expect(del.headers()["cache-control"]).toBe("no-store");
      expect(await del.text()).toBe("");

      const again = await request.delete(`/api/v1/resources/${resource.id}`, { headers });
      expect(again.status()).toBe(404);
      expect(await again.json()).toEqual({ error: "Resource not found" });
    } finally {
      await cleanup(request, created);
    }
  });

  test("invalid input is a 400 that names the fields", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    const created: string[] = [];
    try {
      const response = await request.post("/api/v1/resources", {
        headers,
        data: { ...draft(courseId, "   "), externalUrl: "http://example.com/file.pdf" },
      });
      if (response.status() === 201) created.push((await response.json()).resource.id);
      expect(response.status()).toBe(400);
      expect(response.headers()["cache-control"]).toBe("no-store");
      const body = await response.json();
      expect(body.error).toBe("Invalid input");
      expect(body.fields).toEqual(expect.arrayContaining(["title", "externalUrl"]));

      const notJson = await request.post("/api/v1/resources", {
        headers: { ...headers, "content-type": "application/json" },
        data: "this is not json",
      });
      expect(notJson.status()).toBe(400);
      expect(await notJson.json()).toEqual({ error: "Invalid request" });

      const notObject = await request.post("/api/v1/resources", { headers, data: [1, 2] });
      expect(notObject.status()).toBe(400);
      expect(await notObject.json()).toEqual({ error: "Invalid request" });
    } finally {
      await cleanup(request, created);
    }
  });

  test("an unknown or malformed id is a 404 on PUT and DELETE", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    for (const id of [randomUUID(), "not-a-uuid"]) {
      const put = await request.put(`/api/v1/resources/${id}`, { headers, data: draft(courseId, uniqueTitle()) });
      expect(put.status(), id).toBe(404);
      expect(await put.json()).toEqual({ error: "Resource not found" });
      const del = await request.delete(`/api/v1/resources/${id}`, { headers });
      expect(del.status(), id).toBe(404);
    }
  });

  test("a draft created by the admin does not open for the public", async ({ request, playwright, baseURL }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const created: string[] = [];
    const anonymous = await playwright.request.newContext({ baseURL: baseURL! });
    try {
      const post = await request.post("/api/v1/resources", { headers: { origin }, data: draft(courseId, uniqueTitle()) });
      expect(post.status()).toBe(201);
      const { resource } = await post.json();
      created.push(resource.id);

      const open = await anonymous.get(`/api/v1/resources/${resource.id}/open`, { maxRedirects: 0 });
      expect(open.status()).toBe(404);
      expect(await open.json()).toEqual({ error: "Resource not found" });
    } finally {
      await anonymous.dispose();
      await cleanup(request, created);
    }
  });
});
