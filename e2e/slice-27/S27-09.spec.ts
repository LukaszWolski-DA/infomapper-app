// S27-09 (slice 27, PRD section 6, Q6 as Łukasz answered): "Page outline for documentation" in "Canvas look" while
// InfoDocumenter is on: Off, A4, A3; Portrait, Landscape; 6, 7, 8 pt; stored in the canvas's look (present only while
// on). The outline draws the pages a whole canvas takes behind the cards, counting what a figure draws (never notes),
// follows a card's drop (not its drag), and never shows on a figure or a thumbnail. Off: no element.

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { canvasUrl, openCanvas } from "../slice-01a/helpers";
import { expect, test, type Page } from "./fixtures";
import { canvasId, changeDb, DEMO_DOCUMENT_NAMES, figureImages, figuresOnly, formUrl, newFigure, openEditor, RETAIL, setWorkspace, signInAs, storedDocument, svgOf } from "./helpers";

const CANVAS = "Customer & orders";
const layer = (page: Page) => page.getByTestId("layer-page-outline");
const pages = (page: Page) => page.getByTestId("page-outline-page");
const controls = (page: Page) => page.getByTestId("page-outline-controls");
const pick = (page: Page, group: string, value: string) => page.getByTestId(group).locator(`button[data-value="${value}"]`).click();
const storedLook = async (id: string) => (await readDb(E2E_DB)).canvas.find((c) => c.id === id)!.look;
const labels = (page: Page) => pages(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-label")));

test("S27-09: the outline's choices in Canvas look, stored in the canvas's look; the pages and their labels; off draws nothing", async ({ page }) => {
  const id = await canvasId(CANVAS);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(id));
  await expect(controls(page)).toContainText("Page outline for documentation");
  // off: no element at all
  await expect(page.locator('[data-testid="group-page-outline"] button[aria-pressed="true"]')).toHaveText("Off");
  await expect(layer(page)).toHaveCount(0);
  await expect(page.locator(".page-outline")).toHaveCount(0);

  // A4: portrait at 7 pt, stored in the look
  await pick(page, "group-page-outline", "A4");
  await expect(pages(page).first()).toBeAttached();
  await expect.poll(async () => (await storedLook(id)).pageOutline).toEqual({ paper: "A4", orientation: "portrait", pt: 7 });
  await expect(page.getByTestId("text-page-outline-hint")).toHaveText("Keep the cards inside page 1 and this canvas prints whole, with attribute names at least 7 pt.");
  const portrait = await pages(page).count();
  const first = (await labels(page))[0]!;
  expect(first).toBe(portrait === 1 ? "A4 portrait at 7 pt · fits on one page" : `A4 portrait at 7 pt · needs ${portrait} pages: move cards into page 1 to keep it whole`);
  if (portrait > 1) expect((await labels(page)).slice(1)).toEqual(Array.from({ length: portrait - 1 }, (_, i) => `page ${i + 2}`));
  // page 1 starts 20 px above and left of what is drawn, as a figure's box (the demo's top left card)
  const db = await readDb(E2E_DB);
  const items = db.canvas_item.filter((i) => i.canvas_id === id && i.deleted_at === null && !i.requirement_id);
  const style = await pages(page).first().getAttribute("style");
  expect(style).toContain(`left: ${Math.floor(Math.min(...items.map((i) => i.x)) - 20)}px`);

  // A3 landscape at 6 pt: larger pages, fewer of them; then 8 pt: smaller pages, more of them
  await pick(page, "group-page-outline", "A3");
  await pick(page, "group-page-outline-orientation", "landscape");
  await pick(page, "group-page-outline-pt", "6");
  await expect.poll(async () => (await storedLook(id)).pageOutline).toEqual({ paper: "A3", orientation: "landscape", pt: 6 });
  await expect(pages(page)).toHaveCount(1);
  expect((await labels(page))[0]).toBe("A3 landscape at 6 pt · fits on one page");
  await pick(page, "group-page-outline", "A4");
  await pick(page, "group-page-outline-pt", "8");
  await expect.poll(async () => (await storedLook(id)).pageOutline).toEqual({ paper: "A4", orientation: "landscape", pt: 8 });
  expect(await pages(page).count()).toBeGreaterThan(1);

  // kept after a reload; off again: no element, and the look without the key
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(pages(page).first()).toBeAttached();
  await pick(page, "group-page-outline", "off");
  await expect(layer(page)).toHaveCount(0);
  await expect.poll(async () => "pageOutline" in (await storedLook(id))).toBe(false);
});

test("S27-09: the outline follows a card's drop, not its drag, and counts no note", async ({ page }) => {
  const id = await canvasId(CANVAS);
  await changeDb((db) => {
    // A3 portrait at 6 pt: about 1,540 by 1,970 px, which the demo's canvas fits on one page
    db.canvas.find((c) => c.id === id)!.look = { ...db.canvas.find((c) => c.id === id)!.look, pageOutline: { paper: "A3", orientation: "portrait", pt: 6 } };
  });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(id), { x: 40, y: 40, zoom: 0.4 });
  await expect(pages(page)).toHaveCount(1);
  const box = await pages(page).first().getAttribute("style");

  // a note far away is not counted (a figure draws no notes)
  const db = await readDb(E2E_DB);
  const note = db.note.find((n) => n.canvas_id === id && n.deleted_at === null && !n.pin_canvas_item_id && !n.pin_frame_id);
  if (note) {
    await changeDb((d) => {
      const n = d.note.find((x) => x.id === note.id)!;
      n.x = 5000;
      n.y = 3000;
    });
    await page.reload();
    await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
    await expect(pages(page)).toHaveCount(1);
    expect(await pages(page).first().getAttribute("style")).toBe(box);
  }

  // a card dragged far to the right: during the drag the pages stay; on the drop they follow
  const item = db.canvas_item.find((i) => i.canvas_id === id && i.entity_id && i.deleted_at === null && db.entity.find((e) => e.id === i.entity_id)?.name === "Customer")!;
  const header = page.locator(`.react-flow__node[data-id="${item.id}"] .c-head`).first();
  const at = (await header.boundingBox())!;
  await page.mouse.move(at.x + 40, at.y + at.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(at.x + 40 + i * 40, at.y + at.height / 2);
  await expect(pages(page)).toHaveCount(1);
  expect(await pages(page).first().getAttribute("style")).toBe(box);
  await page.mouse.up();
  await expect.poll(() => pages(page).count()).toBeGreaterThan(1);
  await expect.poll(async () => (await readDb(E2E_DB)).canvas_item.find((i) => i.id === item.id)!.x).toBeGreaterThan(item.x + 600);
});

test("S27-09: never on a figure or a thumbnail; offered only while InfoDocumenter is on", async ({ page }) => {
  const id = await canvasId(CANVAS);
  await figuresOnly(DEMO_DOCUMENT_NAMES.shared, [newFigure("f1", id)]);
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await signInAs(page, "Łukasz");
  const thumb = `/w/${RETAIL}/thumbnail/${id}`;
  const figure = async () => {
    await openEditor(page, formUrl(doc.id));
    return svgOf(page, (await figureImages(page))[0]!.src);
  };
  const [thumbOff, figureOff] = [await (await page.request.get(thumb)).text(), await figure()];
  await changeDb((db) => {
    db.canvas.find((c) => c.id === id)!.look = { ...db.canvas.find((c) => c.id === id)!.look, pageOutline: { paper: "A4", orientation: "landscape", pt: 7 } };
  });
  expect(await (await page.request.get(thumb)).text()).toBe(thumbOff);
  expect(await figure()).toBe(figureOff);

  // InfoDocumenter off: no control, no outline, though the look keeps its key
  await setWorkspace(RETAIL, { infodoc: false });
  await openCanvas(page, canvasUrl(id));
  await expect(page.getByTestId("section-canvas-look")).toBeVisible();
  await expect(controls(page)).toHaveCount(0);
  await expect(layer(page)).toHaveCount(0);
  expect((await storedLook(id)).pageOutline).toEqual({ paper: "A4", orientation: "landscape", pt: 7 });
});
