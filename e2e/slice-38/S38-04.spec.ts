// S38-04 (slice 38, step 5): InfoDocumenter's editor follows InfoMapper's pattern. The app's top bar stays (the path,
// the account); under it the document's bar in one row of 48 px with today's controls in today's order (S28-01 reads it):
// the sections' toggle, back, the name, Shared / Private and Read only, the page count, the preview mode, zoom,
// Print / PDF, Markdown, the save pair, the options' toggle. At 1,280 px it never wraps, with a long name and read only;
// the name ends with an ellipsis while it is not being edited, its full name in the field's title.

import { DEMO_DOCUMENT_NAMES } from "../../src/modules/infodocumenter/data/demo";
import { expect, test, type Page } from "../slice-28/fixtures";
import { changeDb, formUrl, openEditor, signInAs, storedDocument } from "../slice-28/helpers";

const LONG = "Order management – source-to-target mapping of every order table for the ETL team, second review";
const ORDER = [
  "button-toggle-sections",
  "link-documentation",
  "input-document-name",
  "badge-sharing",
  "text-pages",
  "select-preview-mode",
  "select-preview-zoom",
  "button-print",
  "button-markdown",
  "group-save",
  "button-toggle-options",
];

/** The bar's height, each shown control's box, and whether they stand in one row (their vertical middles within 1 px). */
const barOf = (page: Page) =>
  page.getByTestId("editor-top").evaluate((bar) => {
    const b = bar.getBoundingClientRect();
    const shown = [...bar.querySelectorAll<HTMLElement>("[data-testid]")].filter((e) => e.getClientRects().length > 0 && !e.parentElement?.closest("[data-testid^='group-']"));
    const boxes = shown.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute("data-testid")!, left: Math.round(r.left), width: Math.round(r.width), middle: r.top + r.height / 2 };
    });
    const middles = boxes.map((x) => x.middle);
    return {
      height: Math.round(b.height),
      ids: boxes.map((x) => x.id),
      widths: Object.fromEntries(boxes.map((x) => [x.id, x.width])),
      oneRow: Math.max(...middles) - Math.min(...middles) <= 1,
      inside: boxes.every((x) => x.left >= b.left - 0.5 && x.left + x.width <= b.right + 0.5),
    };
  });

async function renameS2T() {
  await changeDb((db) => {
    const docs = (db as unknown as { document_definition: { name: string; deleted_at: string | null }[] }).document_definition;
    docs.find((d) => d.name === DEMO_DOCUMENT_NAMES.s2t && d.deleted_at === null)!.name = LONG;
  });
}

test("S38-04: the document's bar is one 48 px row at 1,280 px with a long name; the name has an ellipsis and its full name in the title", async ({ page }) => {
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.s2t))!;
  await renameS2T();
  await signInAs(page, "Łukasz");
  // slice 28's fixtures open the editor at 1,536 px: the criterion's width
  await page.setViewportSize({ width: 1280, height: 770 });
  await openEditor(page, formUrl(doc.id));

  // the app's top bar above it, as everywhere
  await expect(page.getByTestId("bar-top")).toBeVisible();
  const bar = await barOf(page);
  console.log(`S38-04 at 1280: ${JSON.stringify(bar)}`);
  expect(bar.ids).toEqual(ORDER);
  expect(bar.oneRow, "one row").toBe(true);
  expect(bar.inside, "nothing past the bar").toBe(true);
  expect(bar.height).toBe(48);

  // the name: cut with an ellipsis while not edited, the full name in its title
  const name = page.getByTestId("input-document-name");
  await expect(name).toHaveAttribute("title", LONG);
  expect(await name.evaluate((e) => getComputedStyle(e).textOverflow)).toBe("ellipsis");
  expect(await name.evaluate((e: HTMLInputElement) => e.scrollWidth > e.clientWidth)).toBe(true);
  // edited, the whole name is there to change
  await name.click();
  await expect(name).toHaveValue(LONG);
  await page.keyboard.press("Escape");
});

test("S38-04: read only, with a long name and the banner, the bar is still one 48 px row at 1,280 px", async ({ page }) => {
  const shared = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await changeDb((db) => {
    const docs = (db as unknown as { document_definition: { id: string; name: string }[] }).document_definition;
    docs.find((d) => d.id === shared.id)!.name = `${LONG} (shared)`;
  });
  await signInAs(page, "Piotr Wiśniewski");
  await page.setViewportSize({ width: 1280, height: 770 });
  await openEditor(page, formUrl(shared.id));
  await expect(page.getByTestId("badge-read-only")).toHaveText("Read only");
  await expect(page.getByTestId("banner-document-read-only")).toBeVisible();
  const bar = await barOf(page);
  console.log(`S38-04 read only at 1280: ${JSON.stringify(bar)}`);
  expect(bar.ids).toEqual([...ORDER.slice(0, 4), "badge-read-only", ...ORDER.slice(4)]);
  expect(bar.oneRow, "one row").toBe(true);
  expect(bar.inside, "nothing past the bar").toBe(true);
  expect(bar.height).toBe(48);
  // the banner stays under the bar
  const banner = (await page.getByTestId("banner-document-read-only").boundingBox())!;
  const top = (await page.getByTestId("editor-top").boundingBox())!;
  expect(banner.y).toBeGreaterThanOrEqual(top.y + top.height - 1);
});
