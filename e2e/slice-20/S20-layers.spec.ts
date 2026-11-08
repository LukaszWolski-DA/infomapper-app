// Slice 20's drawing layers and elements for the model checks' marks (AD-24; measurement build only, MEASURE=1
// MEASURE_BUILD=production after `npm run measure:build`): the canvas "Sales star" from slice 19's demo (the same data
// on this branch and on slice-19: `addTypesDemoData`, `addFullDemoData` there), read with CDP's LayerTree as S15-layers
// does; then three attributes renamed to a neighbour's name in the e2e data file (Product.list_price to "SKU",
// Customer.created_at to "Email", Sales Order.status_code to "Currency_Code"), which gives this branch three duplicate
// names: six row marks and three header marks, and changes no element. The same file runs on slice-19 for the A/B.
// Results in test-results/S20-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-20/S20-layers.spec.ts

import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import * as seed from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { signInAs } from "../slice-00/helpers";
import { openCanvas } from "../slice-01a/helpers";
import { MEASURE_USE } from "../slice-01b/measure";
import { starUrl, STAR_VIEW } from "../slice-15a/helpers";

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
    headMarks: await page.locator(".c-l2.chk").count(),
    rowMarks: await page.locator(".row.chk").count(),
  };
}

async function readSettled(page: Page) {
  await openCanvas(page, starUrl(), STAR_VIEW);
  await expect(page.getByTestId("button-back")).toBeEnabled();
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
  return layers(page);
}

test("S20-layers: the Sales star without and with the checks' marks", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  const s = seed as unknown as Record<string, (db: unknown) => unknown>;
  await resetDevData(E2E_DB, (s.addTypesDemoData ?? s.addFullDemoData) as never);
  await signInAs(page, "Łukasz");
  const without = await readSettled(page);

  const db = await readDb(E2E_DB);
  const entity = (name: string) => db.entity.find((e) => e.name === name && e.deleted_at === null)!.id;
  for (const [e, from, to] of [["Product", "list_price", "SKU"], ["Customer", "created_at", "Email"], ["Sales Order", "status_code", "Currency_Code"]] as const) {
    db.attribute.find((a) => a.entity_id === entity(e) && a.name === from)!.name = to;
  }
  await writeDb(E2E_DB, db);
  const withMarks = await readSettled(page);

  const result = { without, withMarks };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S20-layers.json", JSON.stringify(result, null, 2));
  console.log("S20-layers", JSON.stringify(result));
  // the marks are classes and pseudo-elements: no element and no drawing layer more (AD-24)
  expect(withMarks.viewportElements).toBe(without.viewportElements);
  expect(withMarks.drawingLayers).toBe(without.drawingLayers);
});
