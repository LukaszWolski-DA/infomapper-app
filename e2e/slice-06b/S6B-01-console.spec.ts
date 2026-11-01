import { expect, test } from "./fixtures";
import { signInAs } from "../slice-00/helpers";
import { backButton, buttonsEnabled, expectAt, forwardButton, projectPath } from "./helpers";

// A regression check (slice 12a's acceptance, 1 November 2026): a link clicked after Back drops the forward entries
// inside Next.js's own push, and the buttons' store heard of it there: React logged "useInsertionEffect must not
// schedule updates." in the console.
test("S6B-01 (console): a link clicked after Back updates the buttons with no React error in the console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await signInAs(page, "Łukasz");
  await page.locator(`a[href$='${projectPath()}']`).first().click();
  await expectAt(page, projectPath());
  await page.locator("a[href*='/c/']").first().click();
  await expectAt(page, new RegExp(`^${projectPath()}/c/`));
  await backButton(page).click();
  await expectAt(page, projectPath());
  await expect(forwardButton(page)).toBeEnabled();

  await page.locator("a[href*='/c/']").first().click();
  await expectAt(page, new RegExp(`^${projectPath()}/c/`));
  await expect.poll(() => buttonsEnabled(page)).toEqual([true, false]);
  expect(errors.filter((e) => /useInsertionEffect/.test(e))).toEqual([]);
});
