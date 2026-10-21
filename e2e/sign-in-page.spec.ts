import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

// The sign-in page's look and feedback. The rate limiter keys on client IP, so each test uses its own.
test.beforeEach(async ({ page }) => {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

test("the brand panel shows on desktop; a phone shows the brand name and the form only", async ({ page, isMobile }) => {
  await page.goto("/sign-in");
  const panel = page.getByTestId("auth-panel");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  if (isMobile) {
    await expect(panel).toBeHidden();
    await expect(page.getByRole("main").getByText("University Assistant", { exact: true }).filter({ visible: true })).toHaveCount(1);
  } else {
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Every course, chapter and past exam in one place.")).toBeVisible();
  }
});

test("the toggle shows and hides the password", async ({ page }) => {
  await page.goto("/sign-in");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("secret-value");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("a wrong password shows the alert, clears and focuses the password, and typing hides the alert", async ({
  page,
}) => {
  // A fresh address each run: failures are also counted per email.
  const email = `nobody-${randomBytes(4).toString("hex")}@example.com`;
  await page.goto("/sign-in");
  const password = page.getByLabel("Password", { exact: true });
  await page.getByLabel("Email").fill(email);
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toHaveText("Invalid email or password.");
  await expect(password).toHaveValue("");
  await expect(password).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.keyboard.type("a");
  await expect(alert).toBeHidden();
});

test('"Back to courses" goes to the Browse destination', async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Back to courses" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Caps Lock is announced while it is on", async ({ page, isMobile }) => {
  test.skip(isMobile, "no physical keyboard");
  await page.goto("/sign-in");
  const password = page.getByLabel("Password", { exact: true });
  await password.focus();
  await expect(page.getByText("Caps Lock is on.")).toBeHidden();
  // Playwright cannot switch the real Caps Lock state, so send a key event that reports it.
  await password.evaluate((input) =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "A", modifierCapsLock: true, bubbles: true })),
  );
  await expect(page.getByText("Caps Lock is on.")).toBeVisible();
});
