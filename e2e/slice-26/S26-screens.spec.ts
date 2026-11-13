// Slice 26, steps 2 and 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-26-screens/<folder>/): the editor
// in Auto with real pages, a section selected, and the quick sheet with "Pages out of date" (the threshold lowered by
// the test hook). The demo with the star and the documents.
//
//   SCREENS=step-2 npx playwright test e2e/slice-26/S26-screens.spec.ts

import path from "node:path";
import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, expectLayouts, formUrl, laidOut, openEditor, pagesOf, preview, rowOfType, setSections, setThreshold, signInAs, storedDocument, viewUrl } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-26-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");
test.use({ viewport: { width: 1440, height: 900 }, seed: "full" });

test("S26 screens: the editor in Auto, a section selected, and Pages out of date", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await openEditor(page, formUrl(doc.id));
  await page.screenshot({ path: path.join(OUT, "1-editor-auto-pages.png") });

  await rowOfType(page, "dict").click();
  await expect(page.locator('[data-testid="panel-section"][data-section="dict"]')).toBeVisible();
  await expect(page.locator('[data-testid="document-host"] .dsec.dselsec').first()).toBeVisible();
  // the smooth scroll has landed: the section's top near the preview's
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector('[data-testid="document-pages"]')!;
        const el = document.querySelector('[data-testid="document-host"] .dsec.dselsec')!;
        return Math.round(el.getBoundingClientRect().top - box.getBoundingClientRect().top);
      }),
    )
    .toBeLessThan(60);
  await page.screenshot({ path: path.join(OUT, "2-editor-section-selected.png") });
});

test("S26 screens: Pages out of date", async ({ page }) => {
  await setThreshold(page, 1);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await openEditor(page, formUrl(doc.id));
  await expectLayouts(page, 1);
  await page.getByTestId("input-cover-subtitle").fill("For the business and the data office");
  await page.getByTestId("input-cover-subtitle").press("Enter");
  await expect(preview(page)).toHaveAttribute("data-shown", "quick");
  await expect(page.getByTestId("note-stale")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "3-editor-pages-out-of-date.png") });
});

// step 3: a readiness page, a source tables page (Data Vault 2.0 mode) and a dictionary page with the dimensional
// entities, as laid out by Paged.js (the pages alone, as they print)
test("S26 screens: readiness, source tables, the dictionary's dimensional entities", async ({ page }) => {
  await changeDb((db) => {
    for (const w of db.workspace) if (w.name === "Retail Co – DWH") w.dv2_mode = true;
  });
  await setSections(DEMO_DOCUMENT_NAMES.shared, [{ type: "ready" }, { type: "sources" }, { type: "dict", options: { entity: ["stereotype", "coverage"], columns: ["attribute", "type", "keys", "mappedFrom"] } }]);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.emulateMedia({ media: "print" });
  const pageWith = (heading: string) => pagesOf(page).filter({ has: page.locator("h2", { hasText: heading }) }).first();
  await pageWith("Model readiness").screenshot({ path: path.join(OUT, "4-readiness-page.png") });
  await pageWith("Source tables").screenshot({ path: path.join(OUT, "5-source-tables-page.png") });
  await pagesOf(page).filter({ has: page.locator("h4", { hasText: "Fact Sales" }) }).first().screenshot({ path: path.join(OUT, "6-dictionary-dimensional-page.png") });
});
