import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, loadModel, mappingLine, openCanvas, pickOption, signInAs, treeItem } from "./helpers";

test("S1A-07: from the left panel: create a concept, add an entity with “+”, rename it, add attributes in the right panel, place a source table, add a mapping from the attribute panel; everything persists after reload", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());

  // New concept
  await page.getByTestId("button-new-concept").click();
  await page.getByTestId("input-tree-name").fill("Loyalty");
  await page.getByTestId("input-tree-name").press("Enter");
  await expectToast(page, "Created the concept Loyalty. Use + next to it to add entities.");
  const loyalty = page.getByTestId("tree-concept").filter({ has: page.getByTestId("tree-concept-head").filter({ hasText: /^Loyalty/ }) });
  await expect(loyalty).toContainText("No entities yet. Use + to add one.");

  // “+”: a new entity with its card, the name ready to type in the right panel (D-46)
  await loyalty.getByTestId("button-concept-add").click();
  await expect(card(page, "New entity")).toBeVisible();
  const name = page.getByTestId("input-entity-name");
  await expect(name).toBeFocused();
  await name.fill("Loyalty Account");
  await name.press("Enter");
  await expect(card(page, "Loyalty Account")).toBeVisible();
  await expect(treeItem(page, "Loyalty Account")).toHaveAttribute("data-presence", "here");

  // two attributes
  for (const attribute of ["account_id", "points"]) {
    await page.getByTestId("button-add-attribute").click();
    const field = page.getByTestId("input-attribute-name");
    await expect(field).toBeFocused();
    await field.fill(attribute);
    await field.press("Enter");
    await expect(card(page, "Loyalty Account").locator("[data-row]").filter({ hasText: attribute })).toBeVisible();
    await card(page, "Loyalty Account").getByTestId("card-name").click(); // back to the entity panel
  }

  // place a source table that is not on this canvas yet
  await page.getByTestId("tab-sources").click();
  await expect(treeItem(page, "items")).not.toHaveAttribute("data-presence", "here");
  await treeItem(page, "items").click();
  await expectToast(page, "Added 1 source table to the canvas.");
  await expect(card(page, "items")).toBeVisible();

  // a mapping from the attribute panel: items.item_code → Loyalty Account.points
  await card(page, "Loyalty Account").locator("[data-row]").filter({ hasText: "points" }).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await pickOption(page.getByTestId("select-add-source-column"), "item_code");
  await expectToast(page, /^Mapped items\.item_code to Loyalty Account\.points/);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();

  // everything persists after reload
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(card(page, "Loyalty Account").locator("[data-row]")).toHaveText([/account_id/, /points/]);
  await expect(card(page, "items")).toBeVisible();
  await expect(page.getByTestId("tree-concept").filter({ hasText: "Loyalty Account" })).toContainText("Loyalty");
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === "Loyalty Account")!;
  expect(model.concepts.find((c) => c.id === entity.concept_id)?.name).toBe("Loyalty");
  const points = model.attributes.find((a) => a.entity_id === entity.id && a.name === "points")!;
  const mapping = model.mappings.find((m) => m.attribute_id === points.id)!;
  expect(mapping.status).toBe("draft");
  await expect(mappingLine(page, mapping.id)).toBeVisible();
});
