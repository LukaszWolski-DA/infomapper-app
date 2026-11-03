// S14A-13's drawing layers (slice 14a, step 4; measurement build only, MEASURE=1 MEASURE_BUILD=production after
// `npm run measure:build`): 20 notes on the demo canvas ("Customer & orders", test data in the e2e data file), read with
// CDP's LayerTree as S11-13 does, three times in one view: without a mark, with the "Not saved" mark on all 20 (20 real
// refusals: Anna changed each note's text, then this page wrote each one on the canvas; no test hook), and again without
// it after Escape dropped each draft. Results in test-results/S14A-13-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-14a/S14A-13-layers.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { createNote, updateNote } from "../../src/domain/commands/note";
import { E2E_PRODUCTION } from "../config";
import { MEASURE_USE } from "../slice-01b/measure";
import { expect, test } from "../slice-13/fixtures";
import { asUser, canvasUrl, hydrated, openCanvas, RETAIL, SEED_IDS, signInAs, store } from "../slice-13/helpers";

test.use(MEASURE_USE);

const CANVAS = SEED_IDS.canvasCustomerOrders;
/** The notes' grid, right of the demo's cards: 5 × 4 notes, 260 × 170 apart. */
const GRID = { x: 2000, y: 0, cols: 5, rows: 4, dx: 260, dy: 170 };
const VIEW = { x: 40 - GRID.x * 0.6, y: 40, zoom: 0.6 };

async function state() {
  const s = store();
  const [canvas, items, frames, notes] = await Promise.all([s.canvases.get(RETAIL, CANVAS), s.canvasItems.listOfCanvas(RETAIL, CANVAS), s.frames.listOfCanvas(RETAIL, CANVAS), s.notes.listOfCanvas(RETAIL, CANVAS)]);
  return { canvas, items, frames, notes };
}

/** Drawing layers and their megapixels (CDP LayerTree), as S11-13 reads them, with the viewport's elements. */
async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  type L = { width: number; height: number; drawsContent: boolean };
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("LayerTree.enable");
  await page.evaluate(() => document.body.style.setProperty("--im-diag", String(Math.random())));
  await page.waitForTimeout(1500);
  const drawing = list.filter((l) => l.drawsContent);
  await cdp.send("LayerTree.disable");
  await cdp.detach();
  return {
    drawingLayers: drawing.length,
    drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1),
    viewportElements: await page.evaluate(() => document.querySelectorAll(".react-flow__viewport *").length),
    marks: await page.getByTestId("note-not-saved").count(),
  };
}

async function editNote(page: Page, id: string) {
  const b = (await page.locator(`[data-note="${id}"]`).getByTestId("note-text").boundingBox())!;
  await page.mouse.dblclick(b.x + b.width / 2, b.y + Math.min(8, b.height / 2));
  await expect(page.getByTestId("input-note-text")).toBeFocused();
}

test("S14A-13 layers: 20 notes without the mark, with it (20 real refusals), and without it again", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(20 * 60_000);
  const ids: string[] = [];
  for (let r = 0; r < GRID.rows; r++)
    for (let c = 0; c < GRID.cols; c++) {
      const st = await state();
      const { note } = await asUser(SEED_IDS.userLukasz, (ctx, access) =>
        createNote(ctx, access, st, { canvasId: CANVAS, text: `Note ${r * GRID.cols + c + 1}: check the load window.`, x: GRID.x + c * GRID.dx, y: GRID.y + r * GRID.dy }),
      );
      ids.push(note.id);
    }

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  await hydrated(page);
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
  const without = await layers(page);

  for (const id of ids) {
    const st = await state();
    const n = st.notes.find((x) => x.id === id)!;
    await asUser(SEED_IDS.userAnna, (ctx, access) => updateNote(ctx, access, st, { noteId: id, expectedVersion: n.version, text: `Anna's text for ${n.body_text}` }));
  }
  for (const id of ids) {
    await editNote(page, id);
    await page.getByTestId("input-note-text").fill("Mine, refused.");
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(`[data-note="${id}"]`).getByTestId("note-not-saved")).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await page.mouse.move(2, 400);
  await page.waitForTimeout(2500);
  const marked = await layers(page);

  for (const id of ids) {
    await editNote(page, id);
    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-note="${id}"]`).getByTestId("note-not-saved")).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await page.mouse.move(2, 400);
  await page.waitForTimeout(2500);
  const again = await layers(page);

  const out = { view: VIEW, notes: ids.length, without, marked, again };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S14A-13-layers.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
  expect(marked.marks).toBe(20);
  expect(again.marks).toBe(0);
});
