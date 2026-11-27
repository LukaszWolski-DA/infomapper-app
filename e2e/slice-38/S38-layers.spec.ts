// Slice 38's drawing layers with the canvas toolbar (B6; AD-24; measurement build only, MEASURE=1
// MEASURE_BUILD=production after `npm run measure:build`): “Performance test” at S3B-15's dense views, 100 % around
// src:57 and 30 % around the same point, read with CDP's LayerTree as S20-layers does, with the toolbar and with its strip
// taken out of the page's layout (`display: none` by an injected style, the same build and data). The toolbar lies over
// the canvas, outside React Flow: it must not add a drawing layer per card or change what the canvas draws; its own box
// may be a layer or two (step 2: two, by overlap). `DIAG_CSS=<style>` tries a style on the toolbar without a build and
// adds each layer's compositing reasons (a diagnosis). Results in test-results/S38-layers.json.
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-38/S38-layers.spec.ts

import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { signInAs } from "../slice-00/helpers";
import { canvasUrl } from "../slice-01a/helpers";
import { MEASURE_USE } from "../slice-01b/measure";

test.use(MEASURE_USE);

async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  type L = { width: number; height: number; drawsContent: boolean; backendNodeId?: number; layerId: string; parentLayerId?: string };
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("LayerTree.enable");
  await page.evaluate(() => document.body.style.setProperty("--im-diag", String(Math.random())));
  await page.waitForTimeout(1500);
  const drawing = list.filter((l) => l.drawsContent);
  // which element each drawing layer belongs to (a diagnosis: its node, or its nearest owning ancestor layer's)
  await cdp.send("DOM.getDocument", { depth: -1 });
  const owners: string[] = [];
  for (const l of drawing) {
    let id = l.backendNodeId, at: L | undefined = l;
    while (!id && at?.parentLayerId) {
      at = list.find((x) => x.layerId === at!.parentLayerId);
      id = at?.backendNodeId;
    }
    let owner = "?";
    if (id) {
      try {
        const d = (await cdp.send("DOM.describeNode", { backendNodeId: id })).node;
        const attrs: string[] = d.attributes ?? [];
        const get = (k: string) => attrs[attrs.indexOf(k) + 1];
        owner = `${d.nodeName.toLowerCase()}${attrs.includes("data-testid") ? `[${get("data-testid")}]` : ""}${attrs.includes("class") ? `.${String(get("class")).split(" ").slice(0, 3).join(".")}` : ""}${l.backendNodeId ? "" : " (ancestor)"}`;
      } catch {
        owner = "?";
      }
    }
    let why = "";
    if (process.env.DIAG_CSS !== undefined) {
      try {
        why = " {" + ((await cdp.send("LayerTree.compositingReasons", { layerId: l.layerId })).compositingReasonIds ?? []).join(",") + "}";
      } catch {
        why = "";
      }
    }
    owners.push(`${Math.round(l.width)}x${Math.round(l.height)} ${owner}${why}`);
  }
  await cdp.send("LayerTree.disable");
  await cdp.detach();
  return {
    drawingLayers: drawing.length,
    drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1),
    sizes: owners.sort(),
    viewportElements: await page.evaluate(() => document.querySelectorAll(".react-flow__viewport *").length),
    pageElements: await page.evaluate(() => document.querySelectorAll("*").length),
    toolbarElements: await page.evaluate(() => document.querySelectorAll('[data-testid="strip-canvas-toolbar"] *').length),
  };
}

test("S38-layers: Performance test at 100 % and 30 % with and without the canvas toolbar", async ({ page }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(5 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const result: Record<string, unknown> = {};
  for (const [name, zoom] of Object.entries({ "100": 1, "30": 0.3 })) {
    await page.goto("/sign-in");
    const view = { x: 768 - src57.x * zoom, y: 300 - src57.y * zoom, zoom };
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
    await page.goto(canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace));
    await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    // a diagnosis only (DIAG_CSS): a style tried on the toolbar without a build
    if (process.env.DIAG_CSS) await page.addStyleTag({ content: process.env.DIAG_CSS });
    await page.mouse.move(2, 400);
    await page.waitForTimeout(2000);
    const withToolbar = await layers(page);
    await page.addStyleTag({ content: '[data-testid="strip-canvas-toolbar"]{display:none!important}' });
    await page.waitForTimeout(1000);
    const without = await layers(page);
    result[`${name} %`] = { withToolbar, without };
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync("test-results/S38-layers.json", JSON.stringify(result, null, 2));
    // the toolbar is outside React Flow's viewport: the canvas draws the same elements
    expect(withToolbar.viewportElements).toBe(without.viewportElements);
    // step 2's read: two layers, both by overlap (CDP's compositing reasons): the strip with the toolbar's box, and a
    // squashing layer from the separator after the layer switch on; a constant, never one per card (AD-24)
    expect(withToolbar.drawingLayers - without.drawingLayers).toBeLessThanOrEqual(2);
  }
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S38-layers.json", JSON.stringify(result, null, 2));
  console.log("S38-layers", JSON.stringify(result));
});
