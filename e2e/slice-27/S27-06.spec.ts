// S27-06 (slice 27, PRD section 6): figures numbered in document order across sections; the list of figures (the
// style's switch, D10) on its own sheet after the contents, its page numbers those the figures stand on, none on the
// quick sheet; the smallest names (D1: 5 to 8 pt, D4 as Łukasz answered: never drawn larger) warn in the figure's line
// when its names fall under them, Diagrams' own size in place of the document's.

import { expect, test, type Page } from "./fixtures";
import {
  canvasId,
  DEMO_DOCUMENT_NAMES,
  expectLayouts,
  formUrl,
  laidOut,
  layouts,
  newFigure,
  openEditor,
  SEED_IDS,
  setSections,
  signInAs,
  storedDocument,
  updateDocumentAs,
  viewUrl,
} from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;

/** The list of figures as laid out: each line's text, its page number and the page its figure starts on. */
const listOfFigures = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-testid="document-host"]')!;
    const pages = [...host.querySelectorAll(".pagedjs_page")];
    return [...host.querySelectorAll(".dlof a")].map((a) => {
      const target = host.querySelector(a.getAttribute("href")!)!;
      // Paged.js resolves target-counter() into a counter it resets on the link's ::after (or the link), as the contents'
      const reset = [getComputedStyle(a, "::after").counterReset, getComputedStyle(a).counterReset].find((r) => r && r !== "none") ?? "";
      return { text: a.textContent, number: Number(reset.split(" ").at(-1)), page: pages.indexOf(target.closest(".pagedjs_page")!) + 1, listPage: pages.indexOf(a.closest(".pagedjs_page")!) + 1 };
    });
  });

test("S27-06: figures numbered across sections; the list of figures after the contents with the pages they stand on", async ({ page }) => {
  const co = await canvasId("Customer & orders");
  const ol = await canvasId("Order lines & products");
  await setSections(DOC, [
    { type: "text", heading: "Introduction", options: { body: "Before the figures." } },
    { type: "figure", options: { figures: [{ ...newFigure("a", co), caption: "First" }, { ...newFigure("b", ol), caption: "Second" }] } },
    { type: "dict" },
    { type: "diagrams", options: { figures: [newFigure("c", co), newFigure("d", ol, null)], legend: false } },
  ]);
  const doc = (await storedDocument(DOC))!;
  await signInAs(page, "Łukasz");

  // off by default: no list
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  await expect(page.getByTestId("document-host").locator(".dlof")).toHaveCount(0);

  await updateDocumentAs(SEED_IDS.userLukasz, DOC, { style: { listOfFigures: true } });
  await page.reload();
  await laidOut(page);
  const list = await listOfFigures(page);
  expect(list.map((l) => l.text)).toEqual(["1First", "2Second", "3Customer & orders", "4Order lines & products"]);
  // on its own sheet after the contents (the title page is 1, the contents 2)
  expect(list.every((l) => l.listPage === 3)).toBe(true);
  await expect(page.getByTestId("document-host").locator(".pagedjs_page").nth(2).locator("h2")).toHaveText("List of figures");
  // its numbers are the pages the figures stand on
  for (const l of list) expect(l.number, l.text!).toBe(l.page);
  expect(list.at(-1)!.page).toBeGreaterThan(list[0]!.page);

  // the quick sheet: the same list, without page numbers
  await openEditor(page, formUrl(doc.id));
  await page.getByTestId("select-preview-mode").selectOption("quick");
  const quick = page.locator('[data-testid="document-quick-box"] .dlof a');
  await expect(quick).toHaveText(["1First", "2Second", "3Customer & orders", "4Order lines & products"]);
  // no page numbers there, in the list as in the contents (no "0": Paged.js's rewritten rule reaches the quick sheet)
  for (const a of await page.locator('[data-testid="document-quick-box"] .dtoc a').all()) expect(await a.evaluate((x) => getComputedStyle(x, "::after").content)).toBe("none");
});

test("S27-06: the smallest names in the style, 5 to 8 pt; a figure whose names fall under them says so, Diagrams' own size in place", async ({ page }) => {
  const co = await canvasId("Customer & orders");
  await setSections(DOC, [{ type: "diagrams", options: { figures: [{ ...newFigure("f1", co), size: "75" }], legend: false } }]);
  const doc = (await storedDocument(DOC))!;
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl(doc.id));
  await page.getByTestId("select-preview-mode").selectOption("exact");
  await page.locator('[data-testid="editor-section"][data-section="diagrams"]').click();
  const line = page.getByTestId("text-figure-summary");
  // 75 %: names at 7 pt; the document's 6 pt: no warning
  await expect(line).toContainText(" · names 7 pt ");
  await expect(line).not.toContainText("smaller than");

  // the style's choices and its hint
  await page.getByTestId("row-editor-document").click();
  const select = page.getByTestId("select-style-smallestPt");
  await expect(select.locator("option")).toHaveText(["5 pt", "6 pt", "7 pt", "8 pt"]);
  const n = await layouts(page);
  await select.selectOption("8");
  await expectLayouts(page, n + 1);
  await expect.poll(async () => (await storedDocument(DOC))!.style.smallestPt).toBe(8);

  // 7 pt under the document's 8 pt: the warning; Diagrams' own 7 pt: none
  await page.locator('[data-testid="editor-section"][data-section="diagrams"]').click();
  await expect(line).toContainText(" · smaller than 8 pt: try one figure per frame, A3 paper, or the page outline on the canvas");
  await expect(page.getByTestId("select-diagrams-warnPt").locator("option").first()).toHaveText("Document's (8 pt)");
  const k = await layouts(page);
  await page.getByTestId("select-diagrams-warnPt").selectOption("7");
  await expectLayouts(page, k + 1);
  await expect(line).not.toContainText("smaller than");
});
