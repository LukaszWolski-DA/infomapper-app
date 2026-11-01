import { expect, test } from "./fixtures";
import { makeFrame, OL, OM_HOME, signInAs, tileOf } from "./helpers";

// S12B-07 (PRD P7, item 8; prototype renderHome): a tile reads "{n} cards, {m} frames. Also in …" with singular and
// plural, and "{n} cards" without frames.

test("S12B-07: the tiles count frames in singular and plural, and say nothing of frames without them", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  const meta = (name: string) => tileOf(page, name).getByTestId("tile-canvas-meta");
  await expect(meta("Customer & orders")).toHaveText("7 cards. Also in Customer 360");
  await expect(meta("Order lines & products")).toHaveText("4 cards");

  await makeFrame({ x: 20, y: 0, width: 800, height: 300 }, { canvasId: OL });
  await page.reload();
  await expect(meta("Order lines & products")).toHaveText("4 cards, 1 frame");

  await makeFrame({ x: 20, y: 320, width: 800, height: 300 }, { canvasId: OL });
  await page.reload();
  await expect(meta("Order lines & products")).toHaveText("4 cards, 2 frames");
});
