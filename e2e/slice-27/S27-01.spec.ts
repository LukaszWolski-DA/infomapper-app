// S27-01 (slice 27, PRD section 6): a figure of a canvas and of one of its frames, drawn in the pages and on the quick
// sheet as images of an SVG drawn from the model (never a screenshot), with its caption and number; a change on the
// canvas (a card moved, an attribute renamed) shows in the figure after the editor's reload and at once on the
// document page.

import { expect, test } from "./fixtures";
import {
  canvasId,
  changeDb,
  DEMO_DOCUMENT_NAMES,
  figureImages,
  figuresOnly,
  formUrl,
  frameAroundFirstEntity,
  laidOut,
  newFigure,
  openEditor,
  pageFigures,
  quickFigures,
  signInAs,
  storedDocument,
  svgOf,
  viewUrl,
} from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;

/** Where a card stands in a figure's SVG: the translate of the card group whose name is `name`. */
function cardAt(svg: string, name: string): number {
  const group = svg.split('<g transform="translate(').find((g) => g.includes(`font-weight="600">${name}</text>`));
  return Number(group!.split(",")[0]);
}
const CANVAS = "Customer & orders";

test("S27-01: a canvas and a frame are drawn in the pages and on the quick sheet with their captions and numbers; a change shows after a reload and at once on the document page", async ({ page }) => {
  const canvas = await canvasId(CANVAS);
  const { frameId } = await frameAroundFirstEntity(CANVAS, "Party core");
  await figuresOnly(DOC, [{ ...newFigure("f-canvas", canvas), caption: "Customers and their orders" }, newFigure("f-frame", canvas, frameId)]);
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");

  // the editor's pages: two figures, numbered, each an image of an SVG made from the model (not a screenshot)
  await openEditor(page, formUrl(id));
  await expect(pageFigures(page)).toHaveCount(2);
  const imgs = await figureImages(page);
  expect(imgs.map((i) => i.caption)).toEqual(["Figure 1. Customers and their orders", `Figure 2. ${CANVAS} · Party core`]);
  for (const i of imgs) {
    expect(i.src).toMatch(/^blob:/);
    expect(i.width).toBeGreaterThan(0);
  }
  const whole = await svgOf(page, imgs[0]!.src);
  expect(whole.startsWith("<svg")).toBe(true);
  expect(whole).toContain(">Customer</text>");
  expect(whole).toContain(">Sales Order</text>");
  expect(whole).toContain(">customer_number</text>");
  // the frame's figure holds its card only, with the frame's name
  const frame = await svgOf(page, imgs[1]!.src);
  expect(frame).toContain(">Party core</text>");
  expect(frame).not.toContain(">Sales Order</text>");
  // its anchor for the list of figures
  await expect(page.locator('[data-testid="document-host"] #fg-1')).toHaveCount(1);
  // the editor's line under each figure in the right panel
  await page.locator('[data-testid="editor-section"][data-section="figure"]').click();
  await expect(page.getByTestId("text-figure-summary").first()).toHaveText(/^1 figure · names [\d.]+ pt · (upright|turned on the page)/);

  // the quick sheet draws the same figures
  await page.getByTestId("select-preview-mode").selectOption("quick");
  await expect(quickFigures(page)).toHaveCount(2);
  const quick = await figureImages(page, "quick");
  expect(quick.map((i) => i.caption)).toEqual(imgs.map((i) => i.caption));
  expect(quick.every((i) => i.src.startsWith("blob:") && i.width > 0)).toBe(true);
  await page.getByTestId("select-preview-mode").selectOption("auto");

  // a change on the canvas: Customer moved 200 px right, customer_number renamed
  await changeDb((db) => {
    const entity = db.entity.find((e) => e.name === "Customer" && e.deleted_at === null)!;
    const item = db.canvas_item.find((i) => i.canvas_id === canvas && i.entity_id === entity.id)!;
    item.x += 200;
    db.attribute.find((a) => a.entity_id === entity.id && a.name === "customer_number")!.name = "customer_no";
  });
  // the editor read the model once: after its reload, the figure shows the change
  const before = cardAt(whole, "Customer");
  await openEditor(page, formUrl(id));
  const after = await svgOf(page, (await figureImages(page))[0]!.src);
  expect(after).toContain(">customer_no</text>");
  expect(after).not.toContain(">customer_number</text>");
  expect(cardAt(after, "Customer")).toBe(before + 200);

  // the document page draws from the model when it opens: the change at once
  await page.goto(viewUrl(id));
  await laidOut(page);
  await expect(pageFigures(page)).toHaveCount(2);
  const viewed = await svgOf(page, (await figureImages(page))[0]!.src);
  expect(viewed).toContain(">customer_no</text>");
});
