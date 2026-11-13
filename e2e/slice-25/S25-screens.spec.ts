// Slice 25, step 4: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-25-screens/<folder>/): the
// Documentation tab, a document's form, and two pages of the shared data dictionary laid out by Paged.js (the title page
// and the first dictionary page). The demo with the star and the documents.
//
//   SCREENS=step-4 npx playwright test e2e/slice-25/S25-screens.spec.ts

import path from "node:path";
import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, docsUrl, formUrl, laidOut, pagesOf, signInAs, storedDocument, viewUrl } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-25-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");
test.use({ viewport: { width: 1440, height: 900 }, seed: "full" });

test("S25 screens: the tab, the form, the title page and a dictionary page", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(docsUrl());
  await expect(page.getByTestId("tab-body-docs")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "1-documentation-tab.png") });

  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(formUrl(doc.id));
  // slice 26: the editor in place of the form
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  await laidOut(page);
  await page.screenshot({ path: path.join(OUT, "2-form.png"), fullPage: true });

  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  // the pages as they print: alone in the page's flow, each whole in a window taller than an A4 page
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.emulateMedia({ media: "print" });
  await pagesOf(page).first().screenshot({ path: path.join(OUT, "3-title-page.png") });
  const dictionary = pagesOf(page).filter({ has: page.locator("h2", { hasText: "Data dictionary" }) });
  await dictionary.screenshot({ path: path.join(OUT, "4-dictionary-page.png") });
});
