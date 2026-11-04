// Slice 15a's drawing layers and elements for the new card marks (AD-24, PRD section 6; measurement build only,
// MEASURE=1 MEASURE_BUILD=production after `npm run measure:build`): the canvas "Sales star" (6 logical cards, 2 facts,
// 3 dimensions) read with CDP's LayerTree as S14A-13 does, then the same canvas with the five entities made logical
// again in the e2e data file (no role, no cube mark, no fact edge): the same cards at the same places, so any difference
// is the marks'. Results in test-results/S15-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15a/S15-layers.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { MEASURE_USE } from "../slice-01b/measure";
import { expect, test } from "./fixtures";
import { hydrated, openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

test.use(MEASURE_USE);

/** Drawing layers and their megapixels (CDP LayerTree), with the viewport's elements and the cards with a role. */
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
    roles: await page.getByTestId("card-role").count(),
    facts: await page.locator(".card.fact").count(),
  };
}

async function readSettled(page: Page) {
  await openCanvas(page, starUrl(), STAR_VIEW);
  await hydrated(page);
  await page.mouse.move(2, 400);
  await page.waitForTimeout(1500);
  return layers(page);
}

test("S15-layers: the Sales star with its roles, then the same cards without them", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  await signInAs(page, "Łukasz");
  const withRoles = await readSettled(page);
  expect(withRoles).toMatchObject({ roles: 5, facts: 2 });

  // the same five entities without InfoCube: logical, no InfoCube rows
  const db = (await readDb(E2E_DB)) as Awaited<ReturnType<typeof readDb>> & { cube_entity?: { deleted_at: string | null }[] };
  const at = new Date().toISOString();
  for (const e of db.entity) if (e.model_level === "dimensional") e.model_level = "logical";
  for (const c of db.cube_entity ?? []) c.deleted_at = at;
  await writeDb(E2E_DB, db);
  const withoutRoles = await readSettled(page);
  expect(withoutRoles).toMatchObject({ roles: 0, facts: 0 });

  const result = { withRoles, withoutRoles };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S15-layers.json", JSON.stringify(result, null, 2));
  console.log("S15-layers", JSON.stringify(result));
  // the marks are classes and a pseudo-element: no element and no drawing layer more (AD-24)
  expect(withRoles.viewportElements).toBe(withoutRoles.viewportElements);
  expect(withRoles.drawingLayers).toBe(withoutRoles.drawingLayers);
});
