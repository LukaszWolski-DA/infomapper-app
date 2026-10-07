import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, headPoint, ids, lasso, loadItems, loadModel, openCanvas, signInAs, toolboxAt, WHOLE } from "./helpers";

test("S2A-06: with Customer and Sales Order selected and their sources taken off the canvas, “Add sources of selected entities” places all missing sources without overlaps in one undo step; “Remove from this canvas” removes the group, and “Undo” in the toast brings it back", async ({ page }) => {
  const { entity } = await ids();
  const model = await loadModel();
  // the feeding source tables of Customer and Sales Order, from the mappings
  const feeding = new Set<string>();
  for (const e of [entity("Customer"), entity("Sales Order")]) {
    for (const m of model.mappings.filter((x) => model.attributes.find((a) => a.id === x.attribute_id)?.entity_id === e.id)) {
      for (const i of model.mappingInputs.filter((x) => x.mapping_id === m.id)) feeding.add(model.sourceColumns.find((c) => c.id === i.source_column_id)!.source_table_id);
    }
  }
  const sources = [...feeding];
  expect(sources.length).toBeGreaterThanOrEqual(3);
  const onCanvas = async () => (await loadItems()).filter((i) => i.source_table_id && feeding.has(i.source_table_id)).length;

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  // take the sources on the left (customers, web_users, order_header) off the canvas, in one go
  await lasso(page, { x: 20, y: 8 }, { x: 310, y: 900 });
  await expect(page.getByTestId("mark-selected")).toHaveCount(3);
  await page.getByTestId("button-selection-remove").click();
  await expectToast(page, "Removed 3 cards from this canvas. They stay in the model with their mappings.");
  const left = await onCanvas();
  expect(left).toBeLessThan(sources.length);

  // select Customer and Sales Order and add the sources of both
  await page.getByTestId("card-name").getByText("Customer", { exact: true }).click();
  const at = await headPoint(page, "Sales Order");
  await page.keyboard.down("Shift");
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up("Shift");
  await page.getByTestId("button-selection-sources").click();
  const added = sources.length - left;
  await expectToast(page, `Added ${added} source table${added === 1 ? "" : "s"} next to the selection.`);
  await expect.poll(onCanvas).toBe(sources.length);
  // no card overlaps another
  const rects = await page.locator(".react-flow__node [data-card]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const p = rects[a]!, q = rects[b]!;
      const overlap = p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5;
      expect(overlap, `cards ${a} and ${b} overlap`).toBe(false);
    }
  }
  // one undo step takes all of them off again (the Undo button, once the page knows the step)
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.getByTestId("button-undo").click();
  await expectToast(page, /^Undone: Place \d+ cards$|^Undone: Place card$/);
  await expect.poll(onCanvas).toBe(left);

  // “Remove from this canvas” from the group's toolbox removes both; “Undo” in the toast brings them back
  const entitiesHere = async () => (await loadItems()).filter((i) => i.entity_id === entity("Customer").id || i.entity_id === entity("Sales Order").id).length;
  await page.keyboard.press("Escape");
  await page.getByTestId("card-name").getByText("Customer", { exact: true }).click();
  await page.keyboard.down("Shift");
  await page.mouse.click((await headPoint(page, "Sales Order")).x, (await headPoint(page, "Sales Order")).y);
  await page.keyboard.up("Shift");
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Remove from this canvas" }).click();
  await expectToast(page, "Removed 2 cards from this canvas. They stay in the model with their mappings.");
  await expect.poll(entitiesHere).toBe(0);
  expect((await loadModel()).entities.some((e) => e.id === entity("Customer").id)).toBe(true); // still in the model
  await page.getByTestId("toast").getByTestId("toast-action").click();
  await expectToast(page, "Undone: Remove 2 cards");
  await expect.poll(entitiesHere).toBe(2);
  await expect(page.getByTestId("card-name").getByText("Customer", { exact: true })).toBeVisible();
});
