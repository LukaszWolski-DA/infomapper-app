import { expect, test } from "./fixtures";
import { CO, expectToast, loadNotes, openCanvas, openCanvasMenu, RETAIL, signInAs, store, canvasUrl, WHOLE_CO } from "./helpers";

test("S3A-11: Duplicate layout copies no notes: the copy has none, the original's notes are unchanged (text, place, pin, frame, status); the toast reads “Duplicated {name}. Only the layout is copied; the model is shared.”", async ({ page }) => {
  const original = await loadNotes();
  expect(original).toHaveLength(3);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("menu-item-duplicate").click();
  await expectToast(page, "Duplicated Customer & orders. Only the layout is copied; the model is shared.");
  await expect.poll(async () => (await store().canvases.list(RETAIL)).some((c) => c.name === "Customer & orders (copy)")).toBe(true);
  const copy = (await store().canvases.list(RETAIL)).find((c) => c.name === "Customer & orders (copy)")!;

  // the copy has no notes, on the page and in the data
  await expect(page).toHaveURL(new RegExp(`/c/${copy.id}`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("note")).toHaveCount(0);
  expect(await loadNotes(copy.id)).toHaveLength(0);
  // its cards are there (the layout is copied)
  expect((await store().canvasItems.listOfCanvas(RETAIL, copy.id)).length).toBe((await store().canvasItems.listOfCanvas(RETAIL, CO)).length);

  // the original's notes are exactly as they were
  expect(await loadNotes()).toEqual(original);
});
