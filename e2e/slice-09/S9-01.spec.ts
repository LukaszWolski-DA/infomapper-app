import { expect, test } from "./fixtures";
import { canvasUrl, groupsOf, loadModel, openCanvas, recordToasts, rowNamed, signInAs, toasts } from "./helpers";

test("S9-01: Precision, Tab, Scale, Enter at once in an attribute's panel: both stored, no toast, two change groups", async ({ page }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  const groups = (await groupsOf(before.id)).length;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  const panel = page.getByTestId("panel-attribute");
  await expect(panel).toHaveAttribute("data-version", String(before.version));

  // the slice 8 case, without waiting for the page between the two saves
  await page.getByTestId("input-type-precision").fill("12");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("input-type-scale")).toBeFocused();
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");

  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.id === before.id)).toMatchObject({ type_precision: 12, type_scale: 2, version: before.version + 2 });
  await expect(panel).toHaveAttribute("data-version", String(before.version + 2));
  expect((await groupsOf(before.id)).length).toBe(groups + 2);
  expect(await toasts(page)).toEqual([]);
});
