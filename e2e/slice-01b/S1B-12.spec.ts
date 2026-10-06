import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { updateEntity } from "../../src/domain/commands/entity";
import { expect, test, type Page } from "./fixtures";
import { asUser, box, canvasUrl, card, expectToast, ids, loadItems, loadModel, openCanvas, rowNamed, SEED_IDS, signInAs } from "./helpers";

/** Ctrl+Z and Ctrl+Shift+Z act outside text fields: leave the field first, as a person would. */
async function key(page: Page, keys: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(keys);
}

test("S1B-12: undo and redo: create, edit, move, reorder and delete are each undone with Ctrl+Z and redone; undo is refused with the message when another session changed the row afterwards", async ({ page }) => {
  const { entity, attribute, model } = await ids();
  const customer = entity("Customer"), salesOrder = entity("Sales Order");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.7 });
  await expect(page.getByTestId("button-undo")).toBeDisabled();
  await expect(page.getByTestId("button-redo")).toBeDisabled();
  const attributesOfCustomer = async () => (await loadModel()).attributes.filter((a) => a.entity_id === customer.id).length;

  // create: a new attribute
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("button-add-attribute").click();
  await expect.poll(attributesOfCustomer).toBe(9);
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await key(page, "Control+z");
  await expectToast(page, "Undone: Create attribute");
  await expect.poll(attributesOfCustomer).toBe(8);
  await expect(page.getByTestId("button-redo")).toBeEnabled();
  await key(page, "Control+Shift+z");
  await expectToast(page, "Redone: Create attribute");
  await expect.poll(attributesOfCustomer).toBe(9);

  // edit: rename Customer (Ctrl+Y redoes too)
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("input-entity-name").fill("Client");
  await page.getByTestId("input-entity-name").press("Enter");
  const nameOf = async (id: string) => (await loadModel()).entities.find((e) => e.id === id)?.name;
  await expect.poll(() => nameOf(customer.id)).toBe("Client");
  await key(page, "Control+z");
  await expectToast(page, "Undone: Rename entity");
  await expect.poll(() => nameOf(customer.id)).toBe("Customer");
  await expect(card(page, "Customer")).toBeVisible();
  await key(page, "Control+y");
  await expectToast(page, "Redone: Rename entity");
  await expect.poll(() => nameOf(customer.id)).toBe("Client");

  // move: drag Sales Order up by its header
  const salesCard = (await loadItems()).find((i) => i.entity_id === salesOrder.id)!;
  const head = await box(card(page, "Sales Order").locator(".c-head .c-l2"));
  const startBox = await box(card(page, "Sales Order").locator("[data-card]"));
  await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2 - i * 10);
  await page.mouse.up();
  const yOf = async () => (await loadItems()).find((i) => i.id === salesCard.id)!.y;
  await expect.poll(yOf).not.toBe(salesCard.y);
  const moved = await yOf();
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move card");
  await expect.poll(yOf).toBe(salesCard.y);
  await expect.poll(async () => Math.abs((await box(card(page, "Sales Order").locator("[data-card]"))).y - startBox.y)).toBeLessThan(1);
  await key(page, "Control+Shift+z");
  await expectToast(page, "Redone: Move card");
  await expect.poll(yOf).toBe(moved);

  // reorder: email one place up
  const orderOf = async () => (await loadModel()).attributes.filter((a) => a.entity_id === customer.id).sort((a, b) => a.sort_order - b.sort_order).map((a) => a.name);
  const before = await orderOf();
  await rowNamed(page, "Client", "email").click();
  await page.keyboard.press("Control+ArrowUp");
  await expect.poll(orderOf).not.toEqual(before);
  const reordered = await orderOf();
  await key(page, "Control+z");
  await expectToast(page, "Undone: Reorder attributes");
  await expect.poll(orderOf).toEqual(before);
  await key(page, "Control+Shift+z");
  await expectToast(page, "Redone: Reorder attributes");
  await expect.poll(orderOf).toEqual(reordered);

  // delete: the mapping into birth_date, at once from its panel
  const birth = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const live = async () => (await loadModel()).mappings.some((m) => m.id === birth.id);
  await rowNamed(page, "Client", "birth_date").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await page.getByTestId("button-delete-mapping").click();
  await expect.poll(live).toBe(false);
  await key(page, "Control+z");
  await expectToast(page, "Undone: Delete mapping");
  await expect.poll(live).toBe(true);
  await key(page, "Control+Shift+z");
  await expectToast(page, "Redone: Delete mapping");
  await expect.poll(live).toBe(false);

  // a change on another canvas says which one
  const other = (await loadItems(undefined, SEED_IDS.canvasOrderLines))[0]!;
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), { x: 0, y: 0, zoom: 0.7 });
  const otherHead = await box(page.locator(`[data-card="${other.id}"] .c-head .c-l2`));
  await page.mouse.move(otherHead.x + otherHead.width / 3, otherHead.y + otherHead.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(otherHead.x + otherHead.width / 3 + i * 8, otherHead.y + otherHead.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await loadItems(undefined, SEED_IDS.canvasOrderLines)).find((i) => i.id === other.id)!.x).not.toBe(other.x);
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.7 });
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move card on Order lines & products");
  await expect.poll(async () => (await loadItems(undefined, SEED_IDS.canvasOrderLines)).find((i) => i.id === other.id)!.x).toBe(other.x);

  // refused: Łukasz renames Sales Order, then Anna (another session) renames it again; Łukasz's undo is refused,
  // the step is dropped, and the next Ctrl+Z goes further back
  await card(page, "Sales Order").getByTestId("card-name").click();
  await page.getByTestId("input-entity-name").fill("Order");
  await page.getByTestId("input-entity-name").press("Enter");
  await expect.poll(() => nameOf(salesOrder.id)).toBe("Order");
  const current = await loadModel();
  await asUser(SEED_IDS.userAnna, (ctx, access) =>
    updateEntity(ctx, access, { entity: current.entities.find((e) => e.id === salesOrder.id)!, entities: current.entities, concept: null }, {
      entityId: salesOrder.id,
      expectedVersion: current.entities.find((e) => e.id === salesOrder.id)!.version,
      name: "Sales order header",
    }),
  );
  await key(page, "Control+z");
  await expectToast(page, "Couldn't undo “Rename entity” because it was changed afterwards. Ctrl+Z again goes further back.");
  await expect(page.getByTestId("toast")).toHaveAttribute("data-kind", "refusal");
  expect(await nameOf(salesOrder.id)).toBe("Sales order header");
  await key(page, "Control+z");
  await expectToast(page, "Undone: Delete mapping");
  await expect.poll(live).toBe(true);

  // a card's change saved by Anna does not enter Łukasz's history (one history per person)
  const anyCard = (await loadItems())[0]!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateCanvasItem(ctx, access, { item: anyCard }, { canvasItemId: anyCard.id, expectedVersion: anyCard.version, collapsed: !anyCard.collapsed }));
  await key(page, "Control+z");
  await expectToast(page, "Undone: Reorder attributes");
});
