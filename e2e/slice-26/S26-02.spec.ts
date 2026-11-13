// S26-02 (slice 26, PRD items 3 to 5, Q3): Auto on the demo lays out pages after a change; with the threshold below the
// last layout's time a change shows the quick sheet with "Pages out of date" and Update pages lays out the pages; Exact
// always lays them out; Quick never does; the old pages stay until the new ones are in.

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, expectLayouts, formUrl, layouts, openEditor, preview, probeWhileLaying, rowOfType, setThreshold, shown, signInAs, storedDocument, whileLaying } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;

/** A change of the document: the dictionary's switch, stored. */
async function toggleDictionary(page: Page) {
  const before = (await storedDocument(SHARED))!.version;
  const box = rowOfType(page, "dict").getByTestId("check-section-on");
  await (await box.isChecked() ? box.uncheck() : box.check());
  await expect.poll(async () => (await storedDocument(SHARED))!.version).toBe(before + 1);
}

const contents = (page: Page) => page.locator('[data-testid="document-host"] .dtoc li');

test("S26-02: Auto lays out real pages after a change on the demo, and the old pages stay until the new ones are in", async ({ page }) => {
  await probeWhileLaying(page);
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl((await storedDocument(SHARED))!.id));
  await expect(page.getByTestId("select-preview-mode")).toHaveValue("auto");
  expect(await layouts(page)).toBe(1);
  await expect(contents(page)).toHaveCount(2);

  await toggleDictionary(page);
  await expectLayouts(page, 2);
  expect(await shown(page)).toBe("pages");
  await expect(contents(page)).toHaveCount(1);
  await expect(page.getByTestId("note-stale")).toHaveCount(0);
  // while the second layout ran, the first one's pages were shown
  const seen = (await whileLaying(page)).filter((s) => s.pages > 0 || s.quick > 0);
  expect(seen.length).toBeGreaterThan(0);
  expect((await whileLaying(page)).slice(-seen.length).every((s) => s.pages > 0)).toBe(true);
});

test("S26-02: with the threshold below the last layout's time, a change shows the quick sheet with Pages out of date; Update pages lays out the pages", async ({ page }) => {
  await setThreshold(page, 1);
  await probeWhileLaying(page);
  await signInAs(page, "Łukasz");
  // the first layout is always real pages: there is no last time yet
  await openEditor(page, formUrl((await storedDocument(SHARED))!.id));
  const ms = Number(await preview(page).getAttribute("data-layout-ms"));

  await toggleDictionary(page);
  await expect(preview(page)).toHaveAttribute("data-shown", "quick");
  await expect(page.getByTestId("note-stale")).toHaveText(`Pages out of date: this document took ${(ms / 1000).toFixed(1)} s to lay out, so the preview shows the quick sheet while you edit.Update pages`);
  await expect(page.getByTestId("document-quick")).toBeVisible();
  // no layout ran for it
  expect(await layouts(page)).toBe(1);

  await page.getByTestId("button-update-pages").click();
  await expectLayouts(page, 2);
  expect(await shown(page)).toBe("pages");
  await expect(page.getByTestId("note-stale")).toHaveCount(0);
  await expect(contents(page)).toHaveCount(1);
  // the quick sheet stayed while the pages were laid out
  const laying = (await whileLaying(page)).slice(-1)[0]!;
  expect(laying.pages + laying.quick).toBeGreaterThan(0);

  // still over the threshold: the next change is the quick sheet again
  await toggleDictionary(page);
  await expect(preview(page)).toHaveAttribute("data-shown", "quick");
  expect(await layouts(page)).toBe(2);
});

test("S26-02: Exact always lays out real pages; Quick never does", async ({ page }) => {
  await setThreshold(page, 1);
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl((await storedDocument(SHARED))!.id));

  // switching the mode lays out nothing again: the pages of the same document are shown
  await page.getByTestId("select-preview-mode").selectOption("exact");
  await expect(preview(page)).toHaveAttribute("data-state", "done");
  expect(await layouts(page)).toBe(1);
  await toggleDictionary(page);
  await expectLayouts(page, 2);
  await expect(page.getByTestId("note-stale")).toHaveCount(0);
  await toggleDictionary(page);
  await expectLayouts(page, 3);

  await page.getByTestId("select-preview-mode").selectOption("quick");
  await expect(preview(page)).toHaveAttribute("data-shown", "quick");
  await toggleDictionary(page);
  await expect(page.getByTestId("document-quick").locator(".dsec")).toHaveCount(1);
  expect(await layouts(page)).toBe(3);
  await expect(page.getByTestId("note-stale")).toHaveCount(0);
  // the quick sheet has no page count; the mode is kept for the session
  await expect(page.getByTestId("text-pages")).toHaveText("");
  await page.reload();
  await expect(page.getByTestId("select-preview-mode")).toHaveValue("quick");
  await expect(preview(page)).toHaveAttribute("data-shown", "quick");
});
