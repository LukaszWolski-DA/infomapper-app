import { expect, test } from "./fixtures";
import { attributeIdOf, card, cardMenuItem, entityIdOf, hydrated, liveCubeInputs, liveCubeMappings, liveEntityNamed, model, openStar, recordToasts, signInAs, toasts, undoButton } from "./helpers";
import { cardWidthOf } from "../../src/domain/model/frames";
import { RETAIL } from "../slice-01a/helpers";
import { cubeStore, STAR } from "../slice-15a/helpers";

// S15-11 (B-2, C9; prototype `askDimFrom`): "Create dimension from this…" in Product's header menu. The dialog proposes
// "Dim Product 2" (the star has Dim Product) and warns while a typed name is taken; with sku and category_code unticked
// it makes Dim Product 2 in Product's concept: product_key first, then the ticked copies in Product's order, a direct
// Draft mapping from each original, its card 80 px to the right of Product's at its height. Nothing changes in
// Product. One undo removes it all.

test("S15-11: Create dimension from Product with two attributes unticked; the numbered name and the duplicate warning; one undo", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const before = await model();
  const product = before.entities.find((e) => e.name === "Product" && e.deleted_at === null)!;

  await (await cardMenuItem(page, "Product", "Create dimension from this…")).click();
  const dialog = page.getByTestId("dialog-create-dimension");
  await expect(dialog).toContainText("Create a dimension from Product");
  await expect(dialog).toContainText("The dimension gets a surrogate key and a copy of each ticked attribute, mapped from the original (direct, Draft). Nothing changes in Product.");
  const name = dialog.getByTestId("input-dimension-name");
  await expect(name).toHaveValue("Dim Product 2");
  await expect(dialog.getByTestId("dimension-attribute")).toHaveText([/product_id\s*Integer · PK/, /sku\s*String/, /product_name\s*String/, /category_code\s*String/, /list_price\s*Decimal/]);

  // a taken name is warned about while typed (InfoMapper's duplicate-name text), as after the create
  await name.fill("dim customer");
  await expect(dialog.getByTestId("note-dimension-duplicate")).toHaveText("Another entity is already called “dim customer”. Rename one of them if they mean different things.");
  await name.fill("Dim Product 2");
  await expect(dialog.getByTestId("note-dimension-duplicate")).toHaveCount(0);

  const sku = await attributeIdOf("Product", "sku");
  const category = await attributeIdOf("Product", "category_code");
  await dialog.locator(`input[data-attribute="${sku}"]`).uncheck();
  await dialog.locator(`input[data-attribute="${category}"]`).uncheck();
  await dialog.getByTestId("button-create-dimension").click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => toasts(page)).toContain("Created Dim Product 2 with 3 attributes fed from Product, plus its key product_key.");

  // the model: the dimension, its key first, the copies, a Draft direct mapping from each original
  await expect.poll(async () => (await liveEntityNamed("Dim Product 2"))?.model_level).toBe("dimensional");
  const after = await model();
  const dim = after.entities.find((e) => e.name === "Dim Product 2" && e.deleted_at === null)!;
  expect(dim.concept_id).toBe(product.concept_id);
  const own = after.attributes.filter((a) => a.entity_id === dim.id && a.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order);
  expect(own.map((a) => [a.name, a.is_primary_key, a.is_nullable])).toEqual([
    ["product_key", true, false],
    ["product_id", false, true],
    ["product_name", false, true],
    ["list_price", false, true],
  ]);
  const mappings = (await liveCubeMappings()).filter((m) => own.some((a) => a.id === m.attribute_id));
  expect(mappings.map((m) => [m.kind, m.status])).toEqual([
    ["direct", "draft"],
    ["direct", "draft"],
    ["direct", "draft"],
  ]);
  const inputs = await liveCubeInputs();
  const originals = mappings.map((m) => inputs.find((i) => i.mapping_id === m.id)!.attribute_id).sort();
  expect(originals).toEqual([await attributeIdOf("Product", "product_id"), await attributeIdOf("Product", "product_name"), await attributeIdOf("Product", "list_price")].sort());
  // nothing changed in Product
  expect(after.attributes.filter((a) => a.entity_id === product.id && a.deleted_at === null)).toHaveLength(before.attributes.filter((a) => a.entity_id === product.id && a.deleted_at === null).length);

  // its card: 80 px to the right of Product's, at its height; selected, its panel open
  const items = (await cubeStore().canvasItems.list(RETAIL)).filter((i) => i.canvas_id === STAR && i.deleted_at === null);
  const original = items.find((i) => i.entity_id === product.id)!;
  const made = items.find((i) => i.entity_id === dim.id)!;
  expect(made.y).toBe(original.y);
  expect(made.x).toBe(original.x + cardWidthOf(original) + 80);
  await expect(card(page, "Dim Product 2")).toHaveCount(1);
  await expect(page.getByTestId("panel-entity").getByTestId("input-entity-name")).toHaveValue("Dim Product 2");
  await expect(page.getByTestId("panel-entity")).toContainText("Attributes and their logical feed");

  // one undo step takes it all
  await undoButton(page).click();
  await expect(card(page, "Dim Product 2")).toHaveCount(0);
  await expect.poll(async () => await liveEntityNamed("Dim Product 2")).toBeUndefined();
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(20);
  expect(entityIdOf("prod")).not.toBe(dim.id);
});
