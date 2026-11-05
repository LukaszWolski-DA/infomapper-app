// Slice 15b's drawing layers and elements for the Σ marks and the role pills (AD-24, R5, RP-D; measurement build only,
// MEASURE=1 MEASURE_BUILD=production after `npm run measure:build`): the canvas "Sales star" with its six measures and
// Dim Date's roles, read with CDP's LayerTree as S15-layers does, then the same canvas with the measures deleted and
// the roles cleared in the e2e data file: the same cards and lines at the same places, the pills showing the verb
// phrase. Any difference is the marks' and the pills' text. Results in test-results/S15B-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15b/S15B-layers.spec.ts

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
    measureRows: await page.locator(".row.meas").count(),
    pills: await page.locator('[data-testid="line-relationship"] .rlab text').allTextContents(),
  };
}

async function readSettled(page: Page) {
  await openCanvas(page, starUrl(), STAR_VIEW);
  await hydrated(page);
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
  return layers(page);
}

test("S15B-layers: the Sales star with its Σ marks and role pills, then without them", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  await signInAs(page, "Łukasz");
  const marked = await readSettled(page);
  expect(marked.measureRows).toBe(6);
  expect(marked.pills).toEqual(expect.arrayContaining(["Order date", "Ship date"]));

  const db = (await readDb(E2E_DB)) as Awaited<ReturnType<typeof readDb>> & { cube_measure?: { deleted_at: string | null }[] };
  const at = new Date().toISOString();
  for (const m of db.cube_measure ?? []) m.deleted_at = at;
  for (const r of db.relationship) {
    r.from_role = null;
    r.to_role = null;
  }
  await writeDb(E2E_DB, db);
  const plain = await readSettled(page);
  expect(plain.measureRows).toBe(0);
  expect(plain.pills).not.toContain("Ship date");

  const result = { marked, plain };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S15B-layers.json", JSON.stringify(result, null, 2));
  console.log("S15B-layers", JSON.stringify(result));
  // the marks are a class and a pseudo-element, the pill's text another string: no element and no drawing layer more
  expect(marked.viewportElements).toBe(plain.viewportElements);
  expect(marked.drawingLayers).toBe(plain.drawingLayers);
});
