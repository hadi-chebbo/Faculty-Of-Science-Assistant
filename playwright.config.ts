import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Override when another checkout already uses 3100 (it would be reused as the test server).
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

// The server runs with the log mail driver and writes every email here; e2e/sign-up-api.spec.ts
// reads the confirmation link from it (same expression there). Outside the repo, so Playwright cleaning cannot touch it.
const mailLogFile = path.join(os.tmpdir(), `ua-e2e-mail-${port}.jsonl`);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first product: the smoke test also runs at phone size.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    // Health is 503 without a database, which Playwright treats as not ready.
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Lets e2e/cron-email-jobs.spec.ts reach the 401 path (the route answers 503 with no secret).
    env: {
      CRON_SECRET: "e2e-only-cron-secret",
      MAIL_DRIVER: "log",
      MAIL_LOG_FILE: mailLogFile,
      APP_URL: `http://localhost:${port}`,
    },
  },
});
