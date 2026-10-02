import { expect, test } from "@playwright/test";
import { checkMappingEnds, fitNodes, nodeBox, openCanvas, setViewport } from "./helpers";

/*
 * C-03: lines attach to the exact row, on the facing side, at every zoom level.
 * For each zoom the full set of 300 mappings (600 ends) is checked in screen space against the rendered rows.
 */
for (const zoom of [0.25, 1, 3]) {
  test(`C-03 all 600 mapping ends sit on their row, facing side, at ${zoom * 100}%`, async ({ page }) => {
    await openCanvas(page);
    // centre on a busy card so the screenshot shows many attachments
    const b = await nodeBox(page, "src:57");
    const vp = page.viewportSize()!;
    await setViewport(page, vp.width / 2 - (b.x + b.w / 2) * zoom, vp.height / 2 - (b.y + 150) * zoom, zoom);
    const res = await checkMappingEnds(page);
    await page.screenshot({ path: `report/c03-zoom${zoom * 100}.png` });
    expect(res.checked).toBe(600);
    expect(res.bad, JSON.stringify(res.bad.slice(0, 3))).toEqual([]);
  });
}

test("C-03 ends stay on their rows after cards move (drag a card across another)", async ({ page }) => {
  await openCanvas(page);
  // move the 200-row card to the middle of the canvas so its lines exit on both sides
  await page.evaluate(() => (window as any).__spike.rf.updateNode("ent:40", { position: { x: 2400, y: 600 } }));
  await page.waitForTimeout(300);
  await fitNodes(page, ["ent:40"], 0.1);
  const res = await checkMappingEnds(page);
  expect(res.bad, JSON.stringify(res.bad.slice(0, 3))).toEqual([]);
});
