import { defineConfig, devices } from "@playwright/test";

// Override when another checkout already uses 3100 (it would be reused as the test server).
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

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
  },
});
