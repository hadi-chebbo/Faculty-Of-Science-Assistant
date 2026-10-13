import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin, like resources-api.spec.ts. Everything created here is a DRAFT
// titled "E2E upload ..." in DEMO502; it is deleted again (with its stored file) in a finally block.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STUDENT_EMAIL = "demo.student@example.com"; // from the demo seed
const STUDENT_PASSWORD = "demo-student-password";
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

// Test-only lookups: no endpoint returns a course id or a file key.
async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const octet = () => randomBytes(1)[0];
const uniqueTitle = () => `E2E upload ${randomBytes(4).toString("hex")}`;

async function signIn(request: APIRequestContext, origin: string, email: string, password: string) {
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

const pdfBytes = () => Buffer.from(`%PDF-1.4\n% E2E ${randomBytes(8).toString("hex")}\n%%EOF\n`);

test.describe("upload API", () => {
  let courseId: string;
  let origin: string;

  test.beforeAll(async () => {
    courseId = (await query<{ id: string }>("SELECT id FROM courses WHERE code = 'DEMO502'"))[0].id;
  });

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  // Deleting a resource also removes its stored object.
  async function cleanup(request: APIRequestContext, ids: string[]) {
    for (const id of ids) await request.delete(`/api/v1/resources/${id}`, { headers: { origin } });
  }

  async function askForUpload(request: APIRequestContext, size: number) {
    return request.post("/api/v1/uploads", { headers: { origin }, data: { size } });
  }

  test("anonymous callers get 401", async ({ request }) => {
    const response = await askForUpload(request, 100);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });

  test("a signed-in student gets 403", async ({ request }) => {
    await signIn(request, origin, STUDENT_EMAIL, STUDENT_PASSWORD);
    const response = await askForUpload(request, 100);
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  test("a foreign origin, or none, is refused even with admin cookies", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const headers of [{ origin: "https://evil.example" }, {}] as Array<Record<string, string>>) {
      const response = await request.post("/api/v1/uploads", { headers, data: { size: 100 } });
      expect(response.status(), JSON.stringify(headers)).toBe(403);
    }
  });

  test("a size over the limit, or not a positive integer, is refused", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const size of [UPLOAD_MAX_BYTES + 1, 0, -5, 1.5]) {
      const response = await askForUpload(request, size);
      expect(response.status(), String(size)).toBe(400);
      expect((await response.json()).fields).toEqual(["file"]);
    }
  });

  test("upload, save with the ticket, open, delete", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const headers = { origin };
    const created: string[] = [];
    try {
      const bytes = pdfBytes();
      const ask = await askForUpload(request, bytes.length);
      expect(ask.status()).toBe(201);
      const { upload, ticket } = await ask.json();
      expect(upload.method).toBe("PUT");
      expect(typeof ticket).toBe("string");

      const put = await request.put(upload.url, { headers: upload.headers, data: bytes });
      expect(put.status()).toBeLessThan(300);

      const title = uniqueTitle();
      const post = await request.post("/api/v1/resources", {
        headers,
        data: { courseId, type: "lecture", title, isPublished: false, fileTicket: ticket },
      });
      expect(post.status()).toBe(201);
      const id = (await post.json()).resource.id as string;
      created.push(id);

      const [row] = await query<{ file_key: string | null }>("SELECT file_key FROM resources WHERE id = $1", [id]);
      expect(row.file_key).toMatch(/^resources\/.+\.pdf$/);

      const open = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
      expect(open.status()).toBe(307);
      const location = open.headers()["location"];
      const served = await request.get(location);
      expect(served.status()).toBe(200);
      expect(served.headers()["content-type"]).toBe("application/pdf");
      expect(Buffer.compare(await served.body(), bytes)).toBe(0);

      const del = await request.delete(`/api/v1/resources/${id}`, { headers });
      expect(del.status()).toBe(204);
      created.pop();
      expect((await request.get(location)).status()).not.toBe(200);
      expect((await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 })).status()).toBe(404);
    } finally {
      await cleanup(request, created);
    }
  });

  test("a file that is not a PDF is refused when saving", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const title = uniqueTitle();
    const bytes = Buffer.from("this is plainly not a PDF document");
    const { upload, ticket } = await (await askForUpload(request, bytes.length)).json();
    expect((await request.put(upload.url, { headers: upload.headers, data: bytes })).status()).toBeLessThan(300);

    const post = await request.post("/api/v1/resources", {
      headers: { origin },
      data: { courseId, type: "lecture", title, isPublished: false, fileTicket: ticket },
    });
    expect(post.status()).toBe(400);
    expect((await post.json()).fields).toEqual(["file"]);
    expect(await query("SELECT 1 FROM resources WHERE title = $1", [title])).toHaveLength(0);
  });

  test("an unknown ticket is refused when saving", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const title = uniqueTitle();
    const post = await request.post("/api/v1/resources", {
      headers: { origin },
      data: { courseId, type: "lecture", title, isPublished: false, fileTicket: randomUUID() },
    });
    expect(post.status()).toBe(400);
    expect((await post.json()).fields).toEqual(["file"]);
  });
});
