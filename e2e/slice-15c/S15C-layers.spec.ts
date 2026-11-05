// Slice 15c's drawing layers and elements for the dimensional lines on the Sales star (AD-24, C7, S15-18; measurement
// build only, MEASURE=1 MEASURE_BUILD=production after `npm run measure:build`): the canvas with its 20 dimensional
// mappings, read with CDP's LayerTree as S15B-layers does, then the same canvas with the mappings deleted in the e2e
// data file. The lines add no drawing layer; their elements are one group for the kind, one per line, and per input
// four (hit target, stroke, start dot, diamond), three more for each ƒ. Results in test-results/S15C-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15c/S15C-layers.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { MEASURE_USE } from "../slice-01b/measure";
import { expect, test } from "./fixtures";
import { hydrated, openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

test.use(MEASURE_USE);

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
    lineLayerElements: await page.evaluate(() => document.querySelectorAll('[data-testid="layer-lines"] *').length),
    lines: await page.locator('[data-testid="layer-lines"] [data-testid="line-module"]').count(),
    inputs: await page.locator('[data-testid="layer-lines"] [data-testid="line-module"] path.s').count(),
    chips: await page.locator('[data-testid="layer-lines"] [data-testid="line-module"] [data-testid="node-f"]').count(),
  };
}

async function readSettled(page: Page) {
  await openCanvas(page, starUrl(), STAR_VIEW);
  await hydrated(page);
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
  return layers(page);
}

test("S15C-layers: the Sales star with its 20 dimensional lines, then without them", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  await signInAs(page, "Łukasz");
  // the first load of a page in the run has a drawing layer count of its own: read once, untold, then the two reads
  await readSettled(page);
  const lined = await readSettled(page);
  expect(lined.lines).toBe(20);

  const db = (await readDb(E2E_DB)) as Awaited<ReturnType<typeof readDb>> & { cube_mapping?: { deleted_at: string | null }[]; cube_mapping_input?: { deleted_at: string | null }[] };
  const at = new Date().toISOString();
  for (const m of [...(db.cube_mapping ?? []), ...(db.cube_mapping_input ?? [])]) m.deleted_at = at;
  await writeDb(E2E_DB, db);
  const plain = await readSettled(page);
  expect(plain.lines).toBe(0);

  const expected = 1 + lined.lines + 4 * lined.inputs + 3 * lined.chips;
  const result = { lined, plain, expectedLineElements: expected };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S15C-layers.json", JSON.stringify(result, null, 2));
  console.log("S15C-layers", JSON.stringify(result));
  // no drawing layer more (on the measurement build Chrome groups the star into fewer layers with the lines: 7 against
  // 10, the same megapixels)
  expect(lined.drawingLayers).toBeLessThanOrEqual(plain.drawingLayers);
  expect(lined.drawingMegapixels).toBe(plain.drawingMegapixels);
  // the fed bar changes width, not elements: every element more is a line's
  expect(lined.viewportElements - plain.viewportElements).toBe(expected);
  expect(lined.lineLayerElements - plain.lineLayerElements).toBe(expected);
});
