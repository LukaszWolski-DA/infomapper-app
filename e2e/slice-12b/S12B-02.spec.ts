import { expect, test } from "./fixtures";
import { canvasData, collapse, expectDrawn, expectedOf, makeFrame, OL, OM_HOME, setCard, signInAs, thumbnailOf, tileOf } from "./helpers";

// S12B-02 (PRD P2, P6): a collapsed frame is drawn as its block and its cards are not drawn (nor their lines); a
// collapsed card is drawn as its header's height.

test("S12B-02: a collapsed frame is its block without its cards; a collapsed card is its header", async ({ page }) => {
  // Order lines & products: order_line and Order Line in the top row, items and Product below
  const frameId = await makeFrame({ x: 20, y: 0, width: 800, height: 300 }, { name: "Top row", canvasId: OL });
  await collapse(frameId);
  await setCard("Product", { collapsed: true }, OL);

  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  const t = (await thumbnailOf(page, tileOf(page, "Order lines & products")))!;
  const data = await canvasData(OL);
  expect(data.items.filter((i) => i.frame_id === frameId)).toHaveLength(2);
  const s = expectDrawn(t, expectedOf(data));
  expect(t.rects.filter((r) => r.kind === "block")).toHaveLength(1);
  expect(t.rects.filter((r) => r.kind === "entity" || r.kind === "table")).toHaveLength(2);
  // the hidden cards' lines go with them; items → Product stays when they are mapped
  expect(t.lines).toBeLessThanOrEqual(1);
  // Product is collapsed: its header's 54 px; items is not
  const product = t.rects.find((r) => r.kind === "entity")!;
  expect(Math.abs(product.h - 54 * s)).toBeLessThanOrEqual(1.5);
  expect(t.rects.find((r) => r.kind === "table")!.h).toBeGreaterThan(product.h * 1.5);
});
