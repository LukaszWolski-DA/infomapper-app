// S6B-02, a focused field (slice 6b; Łukasz's step 2 answer): a new entity made from the toolbox is selected (a place,
// pushed) while its name field in the details panel has the focus (slice 5a). The push must not blur the field: the
// name is typed without a click, saved with Enter, and the field kept the focus throughout.

import { expect, test } from "./fixtures";
import { canvasUrl, emptySpot, expectSelected, loadModel, openCanvas, signInAs, toolboxAt, WHOLE_CO } from "./helpers";

test("S6B-02: a new entity's name is typed straight away; the place it records does not take the focus", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const length = () => page.evaluate(() => (window as unknown as { navigation: { entries: () => unknown[] } }).navigation.entries().length);
  const start = await length();

  await toolboxAt(page, await emptySpot(page));
  await page.getByTestId("menu-toolbox").getByTestId("toolbox-item").filter({ hasText: "New entity here" }).click();
  const name = page.getByTestId("input-entity-name");
  await expect(name).toBeFocused();
  await expect.poll(length).toBe(start + 1);
  await page.keyboard.type("Loyalty Card");
  await expect(name).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Loyalty Card")).toBe(true);
  await expectSelected(page, "entity:Loyalty Card");
});
