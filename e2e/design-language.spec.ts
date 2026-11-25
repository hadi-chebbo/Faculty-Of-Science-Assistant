import { expect, test } from "@playwright/test";

// Needs the demo data. A resource row names its type and colours it, so a lecture and an exam look different
// at a glance (and the name is there for anyone who cannot tell colours apart).
test("a lecture row and an exam row name their type and use different colours", async ({ page }) => {
  await page.goto("/courses/DEMO401");

  const lectureRow = page.getByRole("listitem").filter({ hasText: "Sample lecture 1" }).locator("visible=true").first();
  const lectureChip = lectureRow.getByText("Lecture", { exact: true });
  await expect(lectureChip).toBeVisible();
  const lectureColour = await lectureChip.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByRole("tab", { name: /Exams/ }).click();
  const examRow = page.getByRole("listitem").filter({ hasText: "Sample final exam 2024" }).locator("visible=true").first();
  const examChip = examRow.getByText("Exam", { exact: true });
  await expect(examChip).toBeVisible();
  const examColour = await examChip.evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(lectureColour).not.toBe(examColour);
});
