import { expect, test } from "./fixtures";
import { canvasUrl, loadModel, openCanvas, recordToasts, rowNamed, signInAs, STALE, toasts } from "./helpers";

const nameOf = async (id: string) => (await loadModel()).attributes.find((a) => a.id === id);

test("S9-05: save, Undo, save again without waiting: Undo waits for the save on its way and undoes it; the next save is stored", async ({ page }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  const panel = page.getByTestId("panel-attribute");
  const name = page.getByTestId("input-attribute-name");

  // something to undo first, shown by the page (Undo is on)
  await name.fill("price_a");
  await name.press("Enter");
  await expect(panel).toHaveAttribute("data-version", String(before.version + 1));
  await expect(page.getByTestId("button-undo")).toBeEnabled();

  // a save, Ctrl+Z while it is on its way, and a save right after: the undo takes back the save before it
  await name.fill("price_b");
  await name.press("Enter");
  await page.keyboard.press("Control+z");
  await name.fill("price_c");
  await name.press("Enter");

  await expect.poll(async () => nameOf(before.id)).toMatchObject({ name: "price_c", version: before.version + 4 });
  const seen = await toasts(page);
  expect(seen).not.toContain(STALE);
  expect(seen.some((t) => t.startsWith("Undone"))).toBe(true);
  await expect(name).toHaveValue("price_c");
});

test("S9-05: Ctrl+Z in a text field undoes its typing, not the model", async ({ page }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  const panel = page.getByTestId("panel-attribute");
  const name = page.getByTestId("input-attribute-name");
  await name.fill("price_a");
  await name.press("Enter");
  await expect(panel).toHaveAttribute("data-version", String(before.version + 1));

  await name.click();
  await page.keyboard.press("End");
  await page.keyboard.type("_x");
  await page.keyboard.press("Control+z");
  await expect(name).not.toHaveValue("price_a_x");
  await page.waitForTimeout(800);
  expect(await nameOf(before.id)).toMatchObject({ name: "price_a", version: before.version + 1 });
  expect((await toasts(page)).some((t) => t.startsWith("Undone"))).toBe(false);
});
