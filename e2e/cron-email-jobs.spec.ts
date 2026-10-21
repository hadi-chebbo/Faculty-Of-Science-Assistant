import { expect, test } from "@playwright/test";

// playwright.config.ts starts the server with this CRON_SECRET. The sweep itself (correct bearer,
// counts) is covered in Vitest by calling the handler.
const URL_PATH = "/api/cron/email-jobs";

test("the sweep refuses a request with no bearer", async ({ request }) => {
  const response = await request.get(URL_PATH);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("the sweep refuses a wrong bearer", async ({ request }) => {
  const response = await request.get(URL_PATH, { headers: { authorization: "Bearer not-the-secret" } });
  expect(response.status()).toBe(401);
});
