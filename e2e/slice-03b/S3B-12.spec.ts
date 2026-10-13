import { expect, test } from "./fixtures";
import { expectToast, labelNamed, linkedTo, liveUrl, openCanvas, openCanvasMenu, openLiveFor, RETAIL, signInAs, store, undo, WHOLE_CO } from "./helpers";

test("S3B-12: renaming CR-23 renames its live canvas; deleting it makes the canvas normal (no live label, no live levels, labeled filters become all), with the toast; Undo brings back label, links and live canvas; Duplicate layout of the live canvas gives a normal canvas", async ({ page }) => {
  test.setTimeout(150_000);
  const live = await openLiveFor("CR-23");
  const cr23 = (await labelNamed("CR-23"))!;
  const links = await linkedTo("CR-23");
  const canvas = () => store().canvases.get(RETAIL, live);
  const items = () => store().canvasItems.listOfCanvas(RETAIL, live);
  await signInAs(page, "Łukasz");

  // rename in the label panel: the live canvas follows while it has the label's name
  await page.goto(`${liveUrl(live)}?label=${cr23.id}`);
  const name = page.getByTestId("input-label-name");
  await name.fill("CR-24");
  await name.press("Enter");
  await expect.poll(async () => (await canvas())!.name).toBe("CR-24");
  await expect(page.getByTestId("tab-canvas").filter({ hasText: "CR-24" })).toHaveCount(1);

  // delete: the canvas becomes normal in the same step, with the toast; Undo brings everything back
  await page.getByTestId("button-label-delete").click();
  await expectToast(page, "Deleted the label CR-24. Its live canvas became a normal canvas.");
  await expect.poll(async () => (await canvas())!.live_label_id).toBeNull();
  expect((await items()).every((i) => i.live_level === null && i.row_filter !== "labeled")).toBe(true);
  expect((await canvas())!.deleted_at).toBeNull();
  await undo(page);
  await expect.poll(async () => (await canvas())!.live_label_id).toBe(cr23.id);
  expect(await linkedTo("CR-24")).toEqual(expect.arrayContaining(links));
  expect((await items()).some((i) => i.live_level === "context" && i.row_filter === "labeled")).toBe(true);

  // Duplicate layout of the live canvas: the copy is a normal canvas from the start, the original stays live
  await openCanvas(page, liveUrl(live), WHOLE_CO);
  const menu = await openCanvasMenu(page, "CR-24");
  await menu.getByTestId("menu-item-duplicate").click();
  await expectToast(page, "Duplicated CR-24. Only the layout is copied; the model is shared.");
  await expect.poll(async () => (await store().canvases.list(RETAIL)).some((c) => c.name === "CR-24 (copy)")).toBe(true);
  const copy = (await store().canvases.list(RETAIL)).find((c) => c.name === "CR-24 (copy)")!;
  expect(copy.live_label_id).toBeNull();
  const copied = await store().canvasItems.listOfCanvas(RETAIL, copy.id);
  expect(copied.length).toBe((await items()).length);
  expect(copied.every((i) => i.live_level === null && i.row_filter !== "labeled")).toBe(true);
  expect((await canvas())!.live_label_id).toBe(cr23.id);
});
