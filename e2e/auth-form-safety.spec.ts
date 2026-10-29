import { expect, test } from "@playwright/test";

const EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

function expectNoCredentialsInUrl(url: string) {
  const lower = decodeURIComponent(url).toLowerCase();
  expect(lower).not.toContain("password");
  expect(lower).not.toContain(EMAIL);
  expect(lower).not.toContain("demo-student");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ["/sign-in", "/sign-up"]) {
    test(`${path} never puts credentials in the URL`, async ({ page }) => {
      await page.goto(path);
      await page.locator("#email").fill(EMAIL);
      await page.locator("#password").fill(PASSWORD);
      await page.locator("#password").press("Enter");
      expectNoCredentialsInUrl(page.url());

      const submit = page.locator('form button[type="submit"]');
      if (await submit.isEnabled()) {
        await submit.click({ timeout: 2000 }).catch(() => {});
      }
      expectNoCredentialsInUrl(page.url());
    });
  }
});

test("sign-in still works with JavaScript", async ({ page }) => {
  await page.goto("/sign-in?next=%2Fsaved");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  expectNoCredentialsInUrl(page.url());
});
