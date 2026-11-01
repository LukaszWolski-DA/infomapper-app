import { expect, test } from "./fixtures";
import { canvasData, CO, expectDrawn, expectedOf, mappedPairs, OL, OM_HOME, signInAs, thumbnailOf, tileOf } from "./helpers";

// S12B-01 (PRD P2, items 5–6): on the seed's project home every canvas tile shows a thumbnail: one shape per entity
// card in its concept's colour, per table card in the physical colour, per free note, per requirement card, and one
// line per table and entity pair with a mapping, at the canvas's places (left to right and top to bottom).

test("S12B-01: the seed's tiles show their canvases' cards, notes, requirement cards and mapping lines", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await expect(page.getByTestId("tile-canvas")).toHaveCount(2);
  await expect(page.getByTestId("tile-thumbnail")).toHaveCount(2);
  for (const [name, canvasId] of [["Customer & orders", CO], ["Order lines & products", OL]] as const) {
    const t = (await thumbnailOf(page, tileOf(page, name)))!;
    const data = await canvasData(canvasId);
    expectDrawn(t, expectedOf(data));
    expect(t.lines, `${name}: one line per mapped pair`).toBe(mappedPairs(data.model, data.items));
    expect(t.lines).toBeGreaterThan(0);
  }
  // Customer & orders has a free note (its two pinned ones are not drawn) and REQ-104's card
  const co = (await thumbnailOf(page, tileOf(page, "Customer & orders")))!;
  expect(co.rects.filter((r) => r.kind === "note").map((r) => r.color)).toEqual(["blue"]);
  expect(co.rects.filter((r) => r.kind === "requirement")).toHaveLength(1);
});
