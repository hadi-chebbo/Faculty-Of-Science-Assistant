import { expect, type Locator } from "@playwright/test";

// Picks an option of a SearchableSelect: opens its picker, types to search, clicks the option.
// `option` is the exact visible text, or a RegExp for part of it (e.g. /^DEMO601 -/).
export async function choose(trigger: Locator, option: string | RegExp): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (typeof option === "string") await dialog.getByRole("combobox").fill(option);
  await dialog.getByRole("option", typeof option === "string" ? { name: option, exact: true } : { name: option }).first().click();
  await expect(dialog).toBeHidden();
}
