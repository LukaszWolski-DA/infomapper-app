import { expect, test } from "./fixtures";
import { callActionDirectly, canvasUrl, captureActionId, card, expectToast, loadItems, loadModel, newSession, openCanvas, RETAIL, SEED_IDS } from "./helpers";

test("S1A-11: as Piotr (reviewer): no edit controls except the mapping status; approving works; every other edit called directly on the server is refused", async ({ browser }) => {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  // a draft mapping into Customer, and its label in the attribute panel (table.column)
  const draft = model.mappings.find((m) => m.status === "draft" && model.attributes.find((a) => a.id === m.attribute_id)?.entity_id === customer.id)!;
  const input = model.sourceColumns.find((c) => c.id === model.mappingInputs.find((i) => i.mapping_id === draft.id)!.source_column_id)!;
  const draftLabel = `${model.sourceTables.find((t) => t.id === input.source_table_id)!.name}.${input.name}`;
  const draftAttribute = draft.attribute_id;

  // Łukasz (owner) uses the edits once, so their action ids can be called again directly as Piotr
  const owner = await newSession(browser, "Łukasz");
  await openCanvas(owner.page, canvasUrl());
  const o = owner.page;
  const createConceptId = await captureActionId(o, async () => {
    await o.getByTestId("button-new-concept").click();
    await o.getByTestId("input-tree-name").fill("Owner concept");
    await o.getByTestId("input-tree-name").press("Enter");
  });
  await expectToast(o, /Created the concept Owner concept/);
  await card(o, "Customer").getByTestId("card-name").click();
  const updateEntityId = await captureActionId(o, async () => {
    await o.getByTestId("input-entity-name").fill("Customer!");
    await o.getByTestId("input-entity-name").press("Enter");
  });
  await expect(card(o, "Customer!")).toBeVisible();
  const collapseId = await captureActionId(o, () => card(o, "customers").getByTestId("button-card-collapse").click());
  await card(o, "Customer!").locator(`[data-row="${draftAttribute}"]`).click();
  await o.getByTestId("list-attribute-mappings").getByRole("button").filter({ hasText: draftLabel }).click();
  const updateMappingId = await captureActionId(o, async () => {
    await o.locator("#f-note").fill("Owner note");
    await o.locator("#f-note").blur();
  });
  await owner.context.close();
  const before = await loadModel();
  const itemsBefore = await loadItems();

  // Piotr sees no edit controls
  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl());
  for (const id of ["button-new-concept", "button-concept-add", "button-concept-menu", "button-card-collapse", "button-card-filter"]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  await page.getByTestId("tab-sources").click();
  await expect(page.getByTestId("button-new-source-table")).toHaveCount(0);

  await card(page, "Customer!").getByTestId("card-name").click();
  await expect(page.getByTestId("input-entity-name")).toHaveAttribute("readonly", "");
  await expect(page.getByTestId("select-entity-stereotype")).toBeDisabled();
  for (const id of ["button-add-attribute", "button-remove-card", "button-delete-entity"]) await expect(page.getByTestId(id)).toHaveCount(0);

  await card(page, "Customer!").locator(`[data-row="${draftAttribute}"]`).click();
  await expect(page.getByTestId("input-attribute-name")).toHaveAttribute("readonly", "");
  await expect(page.getByTestId("select-add-source-column")).toHaveCount(0);
  await expect(page.getByTestId("button-delete-attribute")).toHaveCount(0);

  // ...except the mapping status: approving works
  await page.getByTestId("list-attribute-mappings").getByRole("button").filter({ hasText: draftLabel }).click();
  const panel = page.getByTestId("panel-mapping");
  await expect(panel.getByTestId("seg-mapping-kind").getByRole("button").first()).toBeDisabled();
  await expect(panel.getByTestId("input-mapping-rule")).toBeDisabled();
  for (const id of ["select-add-input", "button-delete-mapping", "button-remove-input"]) await expect(panel.getByTestId(id)).toHaveCount(0);
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved" }).click();
  await expect(panel.getByTestId("seg-mapping-status").locator('[aria-pressed="true"]')).toHaveText("Approved");
  expect((await loadModel()).mappings.find((m) => m.id === draft.id)).toMatchObject({ status: "approved", approved_by: SEED_IDS.userPiotr });

  // every other edit, called directly on the server, is refused and changes nothing
  const entity = before.entities.find((e) => e.id === customer.id)!;
  const mapping = before.mappings.find((m) => m.id === draft.id)!;
  const card_ = itemsBefore.find((i) => i.source_table_id === before.sourceTables.find((t) => t.name === "customers")!.id)!;
  const replies = [
    await callActionDirectly(page, createConceptId, [RETAIL, { name: "Sneaky" }]),
    await callActionDirectly(page, updateEntityId, [RETAIL, { entityId: entity.id, expectedVersion: entity.version, name: "Sneaky" }]),
    await callActionDirectly(page, updateMappingId, [RETAIL, { mappingId: mapping.id, expectedVersion: mapping.version + 1, note: "Sneaky" }]),
  ];
  for (const reply of replies) expect(reply).toContain("As a reviewer you cannot edit the model.");
  const collapseReply = await callActionDirectly(page, collapseId, [RETAIL, { canvasItemId: card_.id, expectedVersion: card_.version, collapsed: false }]);
  expect(collapseReply).toContain("As a reviewer you cannot change what is on a canvas.");

  const after = await loadModel();
  expect(after.concepts.some((c) => c.name === "Sneaky")).toBe(false);
  expect(after.entities.find((e) => e.id === customer.id)!.name).toBe("Customer!");
  expect(after.mappings.find((m) => m.id === draft.id)!.note_text).toBe("Owner note");
  expect((await loadItems()).find((i) => i.id === card_.id)!.collapsed).toBe(true);
});
