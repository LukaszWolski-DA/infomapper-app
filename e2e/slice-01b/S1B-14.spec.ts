import { expect, test } from "./fixtures";
import {
  callActionDirectly,
  canvasUrl,
  captureActionId,
  card,
  closeToolbox,
  dragTo,
  emptySpot,
  expectToast,
  ids,
  LEFT_AT_100,
  loadItems,
  loadModel,
  newSession,
  openCanvas,
  pointOnLine,
  RETAIL,
  rowNamed,
  toolboxAt,
} from "./helpers";

test("S1B-14: a reviewer gets no drag, relate, tool or reorder actions, and can undo only their own status changes; direct server calls are refused", async ({ browser }) => {
  const { entity, attribute, column } = await ids();
  const customer = entity("Customer"), country = entity("Country");

  // Łukasz (owner) uses the slice's writes once, so their action ids can be called again directly as Piotr
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, canvasUrl(), { x: -150, y: 0, zoom: 0.7 });
  const relateId = await captureActionId(o, async () => {
    await card(o, "Customer").getByTestId("button-card-relate").click();
    await card(o, "Sales Order").getByTestId("card-name").click();
  });
  await expectToast(o, "Relationship added. Name it and set the cardinality on the right.");
  const reorderId = await captureActionId(o, async () => {
    await rowNamed(o, "Customer", "email").click();
    await o.keyboard.press("Control+ArrowUp");
  });
  await expect(o.getByTestId("row-moved")).toHaveCount(1);
  const widthId = await captureActionId(o, async () => card(o, "Customer").getByTestId("handle-card-width").dblclick());
  await openCanvas(o, canvasUrl(), LEFT_AT_100);
  const fromColumnId = await captureActionId(o, () => dragTo(o, rowNamed(o, "customers", "segment"), card(o, "Customer").locator(".c-head")));
  await expect.poll(async () => (await loadModel()).attributes.some((a) => a.entity_id === customer.id && a.name === "segment")).toBe(true);
  await o.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const undoId = await captureActionId(o, () => o.keyboard.press("Control+z"));
  await expectToast(o, "Undone: Create attribute");
  await owner.context.close();
  const before = await loadModel();
  const itemsBefore = await loadItems();

  // Piotr sees no drag, relate, tool or reorder actions
  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);
  for (const id of ["button-tool-entity", "button-card-relate", "handle-card-width"]) await expect(page.getByTestId(id), id).toHaveCount(0);
  await expect(page.getByTestId("button-undo")).toBeDisabled(); // Łukasz's changes are not his to undo

  // dragging a column does nothing
  await dragTo(page, rowNamed(page, "customers", "segment"), rowNamed(page, "Customer", "segment_code"));
  await expect(page.getByTestId("popover-map-choice")).toHaveCount(0);
  await expect(page.getByTestId("line-draft")).toHaveCount(0);
  // Ctrl+↑ on an attribute does nothing
  await rowNamed(page, "Customer", "customer_number").click();
  await page.keyboard.press("Control+ArrowUp");
  await card(page, "Customer").getByTestId("card-name").click();
  await expect(page.getByTestId("attribute-order-item")).toHaveCount(0);
  await expect(page.getByTestId("button-feed-all")).toHaveCount(0);
  // the toolbox has no editing actions: on the canvas only what selects or moves the view (slice 2a adds “Select all”
  // and the Hand tool for every role), on a card nothing to change
  expect(await toolboxAt(page, await emptySpot(page))).toEqual(["Select all", "Fit everything on screen", "Hand tool"]);
  await expect(page.getByTestId("input-toolbox-search")).toHaveCount(0);
  await closeToolbox(page);
  const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await page.mouse.click(head.x + 20, head.y + 10, { button: "right" });
  await expect(page.getByTestId("panel-entity")).toBeVisible(); // selected, but no toolbox: nothing to offer
  await expect(page.getByTestId("menu-toolbox")).toHaveCount(0);
  expect(await loadModel()).toEqual(before);
  expect(await loadItems()).toEqual(itemsBefore);

  // he can set a mapping's status (the toolbox offers only that), and undo and redo his own status change
  const birth = before.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const line = page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${birth.id}"]`);
  expect(await toolboxAt(page, await pointOnLine(line))).toEqual(["Draft", "In review", "Approved"]);
  await page.getByTestId("menu-toolbox").getByRole("menuitemradio", { name: "Approved" }).click();
  const statusOf = async () => (await loadModel()).mappings.find((m) => m.id === birth.id)!.status;
  await expect.poll(statusOf).toBe("approved");
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.getByTestId("button-undo").click();
  await expectToast(page, "Undone: Set mapping status");
  await expect.poll(statusOf).toBe(birth.status);
  await page.getByTestId("button-redo").click();
  await expectToast(page, "Redone: Set mapping status");
  await expect.poll(statusOf).toBe("approved");
  // Delete on the selected line does nothing for him
  await page.keyboard.press("Delete");
  await page.waitForTimeout(500);
  expect((await loadModel()).mappings.some((m) => m.id === birth.id)).toBe(true);

  // direct server calls are refused and change nothing
  const lineCard = itemsBefore.find((i) => i.entity_id === customer.id)!;
  const email = before.attributes.find((a) => a.id === attribute("Customer", "email").id)!;
  const model1 = await loadModel();
  const replies = {
    relate: await callActionDirectly(page, relateId, [RETAIL, { fromEntityId: customer.id, toEntityId: country.id }]),
    reorder: await callActionDirectly(page, reorderId, [RETAIL, { attributeId: email.id, expectedVersion: email.version, position: 0 }]),
    fromColumn: await callActionDirectly(page, fromColumnId, [RETAIL, { entityId: customer.id, sourceColumnId: column("customers", "segment").id }]),
    width: await callActionDirectly(page, widthId, [RETAIL, { canvasItemId: lineCard.id, expectedVersion: lineCard.version, width: 400 }]),
  };
  expect(replies.relate).toContain("As a reviewer you cannot edit the model.");
  expect(replies.reorder).toContain("As a reviewer you cannot edit the model.");
  expect(replies.fromColumn).toContain("As a reviewer you cannot edit the model.");
  expect(replies.width).toContain("As a reviewer you cannot change what is on a canvas.");
  // undo, called directly, undoes only his own steps: his status change, then nothing (not Łukasz's changes)
  expect(await callActionDirectly(page, undoId, [RETAIL, "undo"])).toContain("Set mapping status");
  expect(await callActionDirectly(page, undoId, [RETAIL, "undo"])).toContain("Nothing to undo.");
  const after = await loadModel();
  expect(after.relationships).toEqual(model1.relationships);
  expect(after.attributes).toEqual(model1.attributes);
  expect(after.mappings.filter((m) => m.id !== birth.id)).toEqual(model1.mappings.filter((m) => m.id !== birth.id));
  expect(after.mappings.find((m) => m.id === birth.id)!.status).toBe(birth.status);
  expect((await loadItems()).find((i) => i.id === lineCard.id)!.width).toBe(lineCard.width);
});
