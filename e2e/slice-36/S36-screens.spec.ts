// Slice 36's screenshots at 1440 x 900 beside the prototype's (local adapter, demo data only): the editor with a
// baseline as its source (the note, the hint, the footer), the preset picker with and without a baseline, a changes
// section with many rows, the Compare dialog with "Make a document", a document whose baseline is gone, and the delete
// dialog with its documents' line.
// On demand: SCREENS=<folder> npm run e2e -- e2e/slice-36/S36-screens.spec.ts (skipped otherwise).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect } from "./fixtures";
import {
  exactPages,
  changeDb,
  changeDocument,
  changesSection,
  DEMO_BASELINE,
  deleteDialog,
  docsUrl,
  documentFromBaseline,
  formUrl,
  laidOut,
  openBaselines,
  openCompare,
  preview,
  rowNamed,
  signInAs,
  STAGE_1,
  storedDocuments,
} from "./helpers";
import { DEMO_DOCUMENT_NAMES } from "../slice-25/helpers";

const folder = process.env.SCREENS;
test.skip(!folder, "SCREENS=<folder> takes the screenshots.");
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-prototype-with-sources.html")).href;
const shot = (page: import("@playwright/test").Page, name: string) => page.screenshot({ path: path.join(folder!, `${name}.png`) });

test.describe("the app, with the demo's baseline", () => {
  test.use({ seed: "full" });

  test("slice 36 screens: the app", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "Łukasz");

    // the editor of a document from Stage 1 sign-off: the note, the hint, the footer (the pages scrolled to page 2)
    await openBaselines(page);
    await rowNamed(page, STAGE_1).getByTestId("button-baseline-new-document").click();
    await page.waitForURL(/\/d\/[^/?]+$/);
    await exactPages(page);
    await shot(page, "app-editor-baseline");
    await preview(page).evaluate((el) => {
      const second = el.querySelectorAll(".pagedjs_page")[1] as HTMLElement | undefined;
      if (second) el.scrollTop = second.offsetTop + second.offsetHeight - el.clientHeight + 40;
    });
    await shot(page, "app-editor-baseline-footer");

    // the preset picker with a baseline
    await page.goto(docsUrl());
    await page.getByTestId("button-new-document").click();
    await expect(page.getByTestId("dialog-new-document")).toBeVisible();
    await shot(page, "app-presets-with-baseline");
    await page.keyboard.press("Escape");

    // a changes section with many rows
    const shared = (await storedDocuments()).find((d) => d.name === DEMO_DOCUMENT_NAMES.shared)!;
    await changeDocument(shared.id, (d) => {
      d.sections = [changesSection()];
    });
    await changeDb((db) => {
      for (const a of db.attribute) if (a.deleted_at === null && a.workspace_id === shared.workspace_id) a.definition_html = `<p>${a.name}: changed for the screenshot.</p>`;
    });
    await page.goto(formUrl(shared.id));
    await exactPages(page);
    await page.locator('[data-testid="editor-section"][data-section="changes"]').click();
    await page.locator('[data-testid="document-host"] h2[id]').last().evaluate((h) => h.scrollIntoView({ block: "start" }));
    await shot(page, "app-changes-section");

    // the Compare dialog with Make a document
    await openBaselines(page);
    await openCompare(page, STAGE_1);
    await shot(page, "app-compare-make-document");
    await page.keyboard.press("Escape");

    // the delete dialog with its documents' line, then the document whose baseline is gone
    const own = await documentFromBaseline(DEMO_BASELINE.id);
    await page.reload();
    await rowNamed(page, STAGE_1).getByTestId("button-baseline-delete").click();
    await expect(deleteDialog(page).getByTestId("text-delete-baseline-documents")).toBeVisible();
    await shot(page, "app-delete-documents");
    await deleteDialog(page).getByTestId("button-confirm-delete-baseline").click();
    await expect(rowNamed(page, STAGE_1)).toHaveCount(0);
    await page.goto(formUrl(own));
    await laidOut(page);
    await page.getByTestId("button-print").hover();
    await shot(page, "app-document-gone");
  });
});

test.describe("the app, without a baseline", () => {
  test.use({ seed: "docs" });

  test("slice 36 screens: the preset picker without a baseline", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "Łukasz");
    await page.goto(docsUrl());
    await page.getByTestId("button-new-document").click();
    await expect(page.getByTestId("dialog-new-document")).toBeVisible();
    await shot(page, "app-presets-without-baseline");
  });
});

test("slice 36 screens: the prototype", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(800);
  const home = async (tab: string) => {
    await page.evaluate((t) => {
      const V = (0, eval)("V") as { wsHome: boolean; wsTab: string };
      V.wsHome = true;
      V.wsTab = t;
      (0, eval)("rebuild")();
    }, tab);
    await page.waitForTimeout(400);
  };
  await home("baselines");
  await shot(page, "prototype-baselines");
  await page.locator(".bl").filter({ hasText: "Stage 1 sign-off" }).locator('[data-bl="cmp"]').click();
  await page.waitForTimeout(300);
  await shot(page, "prototype-compare-make-document");
  await page.keyboard.press("Escape");
  await page.locator(".bl").filter({ hasText: "Stage 1 sign-off" }).locator('[data-bl="del"]').click();
  await page.waitForTimeout(300);
  await shot(page, "prototype-delete-documents");
  await page.keyboard.press("Escape");
  await page.locator(".bl").filter({ hasText: "Stage 1 sign-off" }).locator("[data-dfrombl]").click();
  await page.waitForTimeout(2500);
  await shot(page, "prototype-editor-baseline");
  await home("docs");
  await page.locator("button", { hasText: "New document" }).first().click({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  await shot(page, "prototype-presets");
});
