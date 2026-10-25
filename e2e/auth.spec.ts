import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Needs the demo data and an admin: SEED_DEMO_DATA=true ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
// Locally these live in .env, which Next.js loads for the server but not for this process.
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

// The server rate-limits by client IP (x-forwarded-for) and email. Each test gets its own
// address so tests cannot lock each other out, and the suite stays repeatable.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signInThroughForm(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// The header account button is the only menu trigger in the top bar.
const accountButton = (page: Page) => page.locator('header button[aria-haspopup="menu"]');

async function sessionCookies(page: Page) {
  const cookies = await page.context().cookies();
  return {
    access: cookies.find((c) => c.name === "ua_access"),
    refresh: cookies.find((c) => c.name === "ua_refresh"),
  };
}

test("a signed-out visitor to /admin is sent to /sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("a wrong password shows a generic error and sets no cookies", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, "definitely-not-the-password");
  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password.");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await page.context().cookies()).toEqual([]);
});

test("an unknown email gets the very same error", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, `nobody-${randomBytes(4).toString("hex")}@example.com`, "whatever-password");
  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password.");
});

test("too many failures show a clear message", async ({ page }) => {
  await ownAddress(page);
  const email = `lockout-${randomBytes(4).toString("hex")}@example.com`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await signInThroughForm(page, email, "wrong-password");
    await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password.");
  }
  await signInThroughForm(page, email, "wrong-password");
  await expect(page.locator("form").getByRole("alert")).toContainText("Too many failed attempts");
});

test("correct credentials reach /admin; the cookies are httpOnly and Lax", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(accountButton(page)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const { access, refresh } = await sessionCookies(page);
  expect(access).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: false, path: "/" });
  expect(refresh).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: false, path: "/api/v1/auth" });
  // Not readable by scripts.
  expect(await page.evaluate(() => document.cookie)).toBe("");

  // Visiting /sign-in while signed in goes straight to /admin.
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/admin$/);
});

test("the admin page is not cached", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  const response = await page.request.get("/admin");
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("signing out ends the session and clears the cookies", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(accountButton(page)).toBeVisible();
  const { refresh } = await sessionCookies(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await sessionCookies(page)).toEqual({ access: undefined, refresh: undefined });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin[^&]*$/);

  // The old refresh token is dead on the server too, not only removed from the browser.
  await page.context().addCookies([
    { name: "ua_refresh", value: refresh!.value, domain: "localhost", path: "/api/v1/auth", httpOnly: true, sameSite: "Lax" },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin[^&]*$/);
});

test("an expired access token is renewed silently from the refresh cookie", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  const before = await sessionCookies(page);

  await page.context().clearCookies({ name: "ua_access" });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(accountButton(page)).toBeVisible();

  const after = await sessionCookies(page);
  expect(after.access).toBeDefined();
  expect(after.refresh?.value).not.toBe(before.refresh?.value);
});

test("a rejected refresh cookie sends the visitor to /sign-in and clears the cookies", async ({ page }) => {
  await ownAddress(page);
  await page.context().addCookies([
    { name: "ua_refresh", value: "not-a-real-token", domain: "localhost", path: "/api/v1/auth", httpOnly: true, sameSite: "Lax" },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin[^&]*$/);
  expect((await sessionCookies(page)).refresh).toBeUndefined();
});

test("the restore route never redirects off the site", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  for (const next of ["//evil.example", "https://evil.example", "/\\evil.example"]) {
    const response = await page.request.get(`/api/v1/auth/restore?next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    const location = new URL(response.headers()["location"]);
    expect(location.origin).toBe(new URL(page.url()).origin);
    expect(location.pathname).toBe("/admin");
  }
});

test("a sign-in POST from a foreign origin is rejected", async ({ page, request, baseURL }) => {
  await ownAddress(page);
  const own = new URL(baseURL!).origin;
  const data = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

  const foreign = await request.post("/api/v1/auth/sign-in", { headers: { origin: "https://evil.example" }, data });
  expect(foreign.status()).toBe(403);
  expect(foreign.headers()["set-cookie"]).toBeUndefined();

  const foreignReferer = await request.post("/api/v1/auth/sign-in", { headers: { referer: "https://evil.example/x" }, data });
  expect(foreignReferer.status()).toBe(403);

  const noOrigin = await request.post("/api/v1/auth/sign-in", { data });
  expect(noOrigin.status()).toBe(403);

  // Same for sign-out and refresh.
  for (const path of ["/api/v1/auth/sign-out", "/api/v1/auth/refresh"]) {
    const response = await request.post(path, { headers: { origin: "https://evil.example" } });
    expect(response.status(), path).toBe(403);
  }

  const ownOrigin = await request.post("/api/v1/auth/sign-in", {
    headers: { origin: own, "x-forwarded-for": "10.9.9.9" },
    data: { email: ADMIN_EMAIL, password: "wrong-password-here" },
  });
  expect(ownOrigin.status()).toBe(401);
  expect(ownOrigin.headers()["cache-control"]).toBe("no-store");
  expect(ownOrigin.headers()["set-cookie"]).toBeUndefined();
});

test("a successful sign-in never puts a token in the response body", async ({ page, request, baseURL }) => {
  await ownAddress(page);
  const own = new URL(baseURL!).origin;
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin: own, "x-forwarded-for": `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.1` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ user: { email: ADMIN_EMAIL, role: "admin" } });
  const setCookie = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
  expect(setCookie).toHaveLength(2);
  for (const { value } of setCookie) {
    expect(value).toMatch(/HttpOnly/i);
    expect(value).toMatch(/SameSite=Lax/i);
  }
});

test("a signed-in student cannot see the admin page", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  // A student is not sent to the admin area after signing in.
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(accountButton(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "Resources" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
});

test("public pages render the same signed in and signed out", async ({ page }) => {
  await ownAddress(page);
  const paths = ["/", "/courses/DEMO301", "/courses/DEMO501"];
  const snapshot = async () => {
    const texts: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // The home page shows a live count of chapters, which other specs change while this one
      // runs. That figure depends on the moment, not on who is looking, so it is left out.
      texts.push((await page.locator("main").innerText()).replace(/(Chapters\s+)\d+/, "$1#"));
    }
    return texts;
  };

  const signedOut = await snapshot();
  await signInThroughForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  const signedIn = await snapshot();

  expect(signedIn).toEqual(signedOut);
  // Drafts only ever appear inside /admin.
  expect(signedIn.join("\n")).not.toContain("Sample draft lecture");
});

test("sign-in returns to the page named by ?next", async ({ page }) => {
  await ownAddress(page);
  await page.goto("/sign-in?next=/courses/DEMO301");
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
});

test("an unsafe ?next is ignored and the default destination is used", async ({ page }) => {
  await ownAddress(page);
  await page.goto(`/sign-in?next=${encodeURIComponent("//evil.example")}`);
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect(new URL(page.url()).hostname).not.toContain("evil");
});

test("a signed-in visitor opening /sign-in?next=... is sent there", async ({ page }) => {
  await ownAddress(page);
  await signInThroughForm(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await page.goto("/sign-in?next=/courses/DEMO301");
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
  await page.goto(`/sign-in?next=${encodeURIComponent("//evil.example")}`);
  await expect(page).toHaveURL((url) => url.pathname === "/");
});

test("a signed-out visitor to an admin page signs in and returns to it", async ({ page }) => {
  await ownAddress(page);
  await page.goto("/admin/resources/new");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fresources%2Fnew$/);
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/resources\/new$/);
});
