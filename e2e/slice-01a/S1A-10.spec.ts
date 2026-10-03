import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, loadModel, openCanvas, SEED_IDS, signInAs, store, treeItem } from "./helpers";

test("S1A-10: deleting Customer shows the impact dialog (8 attributes, mappings with the approved count, 2 relationships, canvases, projects); confirming removes it everywhere. A concept with entities is deleted only after moving them", async ({ page }) => {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const attrIds = new Set(model.attributes.filter((a) => a.entity_id === customer.id).map((a) => a.id));
  const maps = model.mappings.filter((m) => attrIds.has(m.attribute_id));
  const approved = maps.filter((m) => m.status === "approved").length;

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();

  const dialog = page.getByTestId("dialog-delete-entity");
  const impact = dialog.getByTestId("table-entity-impact");
  await expect(impact).toBeVisible();
  await expect(impact.locator("tbody tr")).toHaveText([
    /^8 attributes\s*deleted$/,
    new RegExp(`^${maps.length} mappings\s*deleted, ${approved} of them approved$`),
    /^2 relationships\s*deleted$/,
    /^1 canvas\s*removed from Customer & orders$/,
    /^2 projects\s*Customer 360, Order management$/,
  ]);
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expectToast(page, "Deleted Customer from the model.");

  // gone everywhere: the card, its lines, the tree, the model
  await expect(card(page, "Customer")).toHaveCount(0);
  await expect(treeItem(page, "Customer")).toHaveCount(0);
  for (const m of maps) await expect(page.locator(`[data-mapping="${m.id}"]`)).toHaveCount(0);
  const after = await loadModel();
  expect(after.entities.some((e) => e.id === customer.id)).toBe(false);
  expect(after.attributes.filter((a) => a.entity_id === customer.id)).toHaveLength(0);
  expect(after.mappings.filter((m) => attrIds.has(m.attribute_id))).toHaveLength(0);
  expect(after.relationships.filter((r) => r.from_entity_id === customer.id || r.to_entity_id === customer.id)).toHaveLength(0);
  expect((await store().canvasItems.list(SEED_IDS.wsRetailDwh)).some((i) => i.entity_id === customer.id)).toBe(false);

  // the concept Customer still holds Customer Address: it goes only after moving that entity
  const concept = page.getByTestId("tree-concept").filter({ has: page.getByTestId("tree-concept-head").filter({ hasText: /^Customer/ }) });
  await concept.getByTestId("button-concept-menu").click();
  await page.getByRole("menuitem", { name: "Delete concept…" }).click();
  const confirm = page.getByTestId("dialog-delete-concept");
  await expect(confirm).toContainText("Customer holds 1 entity: Customer Address. Entities are not deleted with a concept; move them first.");
  await confirm.getByTestId("select-move-to").selectOption({ label: "Sales" });
  await confirm.getByTestId("button-confirm-delete-concept").click();
  await expectToast(page, "Moved the entities to Sales and deleted Customer.");
  await expect(page.getByTestId("tree-concept-head").filter({ hasText: /^Customer/ })).toHaveCount(0);
  await expect(page.getByTestId("tree-concept").filter({ has: page.getByTestId("tree-concept-head").filter({ hasText: /^Sales/ }) })).toContainText("Customer Address");
  const final = await loadModel();
  const sales = final.concepts.find((c) => c.name === "Sales")!;
  expect(final.entities.find((e) => e.name === "Customer Address")!.concept_id).toBe(sales.id);
});
