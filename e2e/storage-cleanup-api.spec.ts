import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Needs the demo data and an admin, like uploads-api.spec.ts. Nothing here can delete a file: every
// request is refused or invalid.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STUDENT_EMAIL = "demo.student@example.com"; // from the demo seed
const STUDENT_PASSWORD = "demo-student-password";
const URL_PATH = "/api/v1/storage/cleanup";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

const octet = () => randomBytes(1)[0];

async function signIn(request: APIRequestContext, origin: string, email: string, password: string) {
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

test.describe("storage cleanup API", () => {
  let origin: string;
  const keys = () => [`resources/${randomUUID()}.pdf`];

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  test("anonymous callers get 401", async ({ request }) => {
    const response = await request.post(URL_PATH, { headers: { origin }, data: { keys: keys() } });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in" });
  });

  test("a signed-in student gets 403", async ({ request }) => {
    await signIn(request, origin, STUDENT_EMAIL, STUDENT_PASSWORD);
    const response = await request.post(URL_PATH, { headers: { origin }, data: { keys: keys() } });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  test("a foreign origin, or none, is refused even with admin cookies", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const headers of [{ origin: "https://evil.example" }, {}] as Array<Record<string, string>>) {
      const response = await request.post(URL_PATH, { headers, data: { keys: keys() } });
      expect(response.status(), JSON.stringify(headers)).toBe(403);
    }
  });

  test("a bad body is refused with 400", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const bodies: unknown[] = [{}, { keys: [] }, { keys: "resources/x.pdf" }, { keys: [5] }, { keys: Array.from({ length: 501 }, () => keys()[0]) }];
    for (const data of bodies) {
      const response = await request.post(URL_PATH, { headers: { origin }, data: data as Record<string, unknown> });
      expect(response.status(), JSON.stringify(data).slice(0, 60)).toBe(400);
      expect((await response.json()).error).toBe("Invalid input");
    }
    const notJson = await request.post(URL_PATH, { headers: { origin, "content-type": "text/plain" }, data: "nope" });
    expect(notJson.status()).toBe(400);
  });

  test("a key that is not abandoned is skipped, not an error", async ({ request }) => {
    await signIn(request, origin, ADMIN_EMAIL, ADMIN_PASSWORD);
    const key = keys()[0];
    const response = await request.post(URL_PATH, { headers: { origin }, data: { keys: [key, "../etc/passwd"] } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ deleted: [], skipped: [key, "../etc/passwd"] });
  });
});
