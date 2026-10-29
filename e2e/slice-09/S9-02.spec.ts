import { expect, test } from "./fixtures";
import { canvasUrl, groupsOf, loadModel, openCanvas, recordToasts, rowNamed, signInAs, toasts } from "./helpers";

test("S9-02: three saves of one attribute in a row, each before the page shows the last: stored in order, the last value stays, a change group each", async ({ page }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  const groups = (await groupsOf(before.id)).length;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  const name = page.getByTestId("input-attribute-name");

  // each Enter saves; the next value is typed straight away, while the earlier saves are still on their way
  for (const value of ["price_a", "price_b", "price_c"]) {
    await name.fill(value);
    await name.press("Enter");
  }

  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.id === before.id)).toMatchObject({ name: "price_c", version: before.version + 3 });
  const written = (await groupsOf(before.id)).slice(groups);
  expect(written.map((g) => g.after?.name)).toEqual(["price_a", "price_b", "price_c"]);
  expect(new Set(written.map((g) => g.group)).size).toBe(3);
  await expect(name).toHaveValue("price_c");
  expect(await toasts(page)).toEqual([]);
});
