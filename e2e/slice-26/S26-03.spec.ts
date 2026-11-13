// S26-03 (slice 26, PRD items 5 and 6, D9): typing in a field refreshes the preview once, about 500 ms after the last
// keystroke, before the field is left; a section clicked on the left scrolls the preview to it; a click in the preview
// selects its section, a double-click goes to its heading.

import { expect, test } from "./fixtures";
import { buildTimes, builds, DEMO_DOCUMENT_NAMES, expectLayouts, formUrl, layouts, openEditor, probeBuilds, rowOfType, signInAs, storedDocument } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;

test("S26-03: typing in a field refreshes the preview once, about 500 ms after the last keystroke", async ({ page }) => {
  await probeBuilds(page);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  const before = { builds: await builds(page), layouts: await layouts(page), times: (await buildTimes(page)).length };

  const field = page.getByTestId("input-cover-subtitle");
  await field.click();
  await field.press("End");
  await field.pressSequentially(" and the data office", { delay: 80 });
  const lastKey = await page.evaluate(() => performance.now());

  // one build, one layout, with the typed text, while the field still has the focus and nothing is saved
  await expectLayouts(page, before.layouts + 1);
  await expect(page.locator('[data-testid="document-host"] .dsub')).toHaveText("For the business and the data office");
  expect(await builds(page)).toBe(before.builds + 1);
  const after = (await buildTimes(page)).slice(before.times);
  expect(after).toHaveLength(1);
  expect(after[0]! - lastKey).toBeGreaterThanOrEqual(400);
  expect(after[0]! - lastKey).toBeLessThan(1500);
  await expect(field).toBeFocused();
  expect((await storedDocument(SHARED))!.cover.subtitle).toBe("For the business");

  // leaving the field saves it; the stored recipe draws the same document, so nothing is laid out again
  await field.press("Enter");
  await expect.poll(async () => (await storedDocument(SHARED))!.cover.subtitle).toBe("For the business and the data office");
  // once the save's page is drawn (the editor shows its version), still one build and one layout
  await expect(page.getByTestId("page-document-editor")).toHaveAttribute("data-version", String(doc.version + 1));
  await expect(page.getByTestId("text-build-ms")).toHaveAttribute("data-builds", String(before.builds + 1));
  expect(await layouts(page)).toBe(before.layouts + 1);
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done");
});

test("S26-03: a section clicked on the left scrolls the preview to it; a click in the preview selects its section", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  const dict = doc.sections.find((s) => s.type === "dict")!;
  await openEditor(page, formUrl(doc.id));
  const scroller = page.getByTestId("document-pages");
  const top = () =>
    page.evaluate((id) => {
      const box = document.querySelector('[data-testid="document-pages"]')!;
      const el = document.querySelector(`[data-testid="document-host"] [data-sec="${id}"]`)!;
      return Math.round(el.getBoundingClientRect().top - box.getBoundingClientRect().top);
    }, dict.id);
  expect(await top()).toBeGreaterThan(400);

  await rowOfType(page, "dict").click();
  // the section's first part comes to the top of the preview and is outlined
  await expect.poll(top).toBeLessThan(60);
  await expect.poll(top).toBeGreaterThanOrEqual(0);
  await expect(page.locator(`[data-testid="document-host"] .dsec.dselsec[data-sec="${dict.id}"]`).first()).toBeVisible();
  await expect(page.locator('[data-testid="panel-section"][data-section="dict"]')).toBeVisible();

  // a click in the preview: the title page selects Document, a section its section
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.locator('[data-testid="document-host"] [data-testid="document-cover"] h1').click();
  await expect(page.getByTestId("panel-document")).toBeVisible();
  await expect(page.getByTestId("row-editor-document")).toHaveAttribute("aria-current", "true");
  const text = doc.sections.find((s) => s.type === "text")!;
  await page.locator(`[data-testid="document-host"] [data-sec="${text.id}"] h2`).first().click();
  await expect(page.locator('[data-testid="panel-section"][data-section="text"]')).toBeVisible();
  await expect(rowOfType(page, "text")).toHaveAttribute("aria-current", "true");

  // a double-click goes to the section's heading (D9: no inline rename)
  await page.locator(`[data-testid="document-host"] [data-sec="${dict.id}"] h2`).first().dblclick();
  await expect(page.getByTestId("input-section-heading")).toBeFocused();
  await expect(page.locator('[data-testid="panel-section"][data-section="dict"]')).toBeVisible();
});
