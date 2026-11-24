// Slice 35's screenshots at 1440 x 900 beside the prototype's (local adapter, demo data only): the tab as an Owner with
// three baselines, the tab as a Reader, the Rename dialog, the Delete dialog, Compare with a filter applied.
// On demand: SCREENS=<folder> npm run e2e -- e2e/slice-35/S35-screens.spec.ts (skipped otherwise).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect } from "./fixtures";
import { createInBox, DEMO_BASELINE, expectToast, openBaselines, openCompare, rowNamed, signInAs } from "./helpers";

test.use({ seed: "full" });

const folder = process.env.SCREENS;
test.skip(!folder, "SCREENS=<folder> takes the screenshots.");
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-prototype-with-sources.html")).href;
const shot = (page: import("@playwright/test").Page, name: string) => page.screenshot({ path: path.join(folder!, `${name}.png`) });

test("slice 35 screens: the app", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  for (const [name, note] of [["Stage 2 sign-off", "Agreed with the data owner."], ["Stage 3 draft", ""]] as const) {
    await createInBox(page, name, note);
    await expectToast(page, `Created the baseline ${name}.`);
  }
  await page.getByTestId("toast").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
  await shot(page, "app-tab-owner");
  await rowNamed(page, "Stage 2 sign-off").getByTestId("button-baseline-rename").click();
  await expect(page.getByTestId("dialog-rename-baseline")).toBeVisible();
  await shot(page, "app-rename");
  await page.keyboard.press("Escape");
  await rowNamed(page, "Stage 2 sign-off").getByTestId("button-baseline-delete").click();
  await expect(page.getByTestId("dialog-delete-baseline")).toBeVisible();
  await shot(page, "app-delete");
  await page.keyboard.press("Escape");
  const dialog = await openCompare(page, DEMO_BASELINE.name);
  await dialog.getByTestId("input-compare-filter").fill("cust");
  await expect(dialog.getByTestId("text-compare-line")).toContainText("shown by the filter");
  await shot(page, "app-compare-filter");
  await page.keyboard.press("Escape");
  await signInAs(page, "Kasia Zielińska");
  await openBaselines(page);
  await shot(page, "app-tab-reader");
});

test("slice 35 screens: the prototype", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(800);
  const home = async () => {
    await page.evaluate(() => {
      const V = (0, eval)("V") as { wsHome: boolean; wsTab: string };
      V.wsHome = true;
      V.wsTab = "baselines";
      (0, eval)("rebuild")();
    });
    await page.waitForTimeout(300);
  };
  await home();
  for (const [name, note] of [["Stage 2 sign-off", "Agreed with the data owner."], ["Stage 3 draft", ""]] as const) {
    await page.locator("#bl-name").fill(name);
    await page.locator("#bl-note").fill(note);
    await page.locator('[data-wa="baseline"]').click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(3500);
  await shot(page, "prototype-tab-owner");
  const row = (name: string) => page.locator(".bl").filter({ hasText: name });
  await row("Stage 2 sign-off").locator('[data-bl="ren"]').click();
  await page.waitForTimeout(200);
  await shot(page, "prototype-rename");
  await page.keyboard.press("Escape");
  await row("Stage 2 sign-off").locator('[data-bl="del"]').click();
  await page.waitForTimeout(200);
  await shot(page, "prototype-delete");
  await page.keyboard.press("Escape");
  await row("Stage 1 sign-off").locator('[data-bl="cmp"]').click();
  await page.locator("#cmp-q").fill("cust");
  await page.waitForTimeout(200);
  await shot(page, "prototype-compare-filter");
  await page.keyboard.press("Escape");
  // as a Reader: the prototype's own member row
  await page.evaluate(() => {
    const ws = (0, eval)("curWs")() as { members: { you?: boolean; role: string }[] };
    ws.members.find((m) => m.you)!.role = "Reader";
  });
  await home();
  await shot(page, "prototype-tab-reader");
});
