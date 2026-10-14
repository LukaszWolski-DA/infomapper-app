import { buildWriteSet } from "../../src/domain/changes";
import { updateEntity } from "../../src/domain/commands/entity";
import { uuidv7 } from "../../src/domain/ids";
import { plainTextPair } from "../../src/domain/model/plain-text";
import { expect, test } from "./fixtures";
import { asPerson, ids, openCanvas, openEntityFromTree, RETAIL, row, SEED_IDS, signInAs, store } from "./helpers";

test("S4A-05: entity and attribute definitions open in the editor without “Insert template”; a plain-text definition stored before this slice opens as its paragraphs; the panel shows a long text shortened with “Show more”", async ({ page }) => {
  const { entity, attribute } = await ids();
  // Order Line: a definition stored as plain text before slice 4a (escaped paragraphs, as plainTextPair wrote them)
  const line = entity("Order Line");
  const legacy = plainTextPair("One product on one order.\n\nQuantity times price,\nless the discount. a < b & c");
  const now = new Date().toISOString();
  const ctx = { actorId: SEED_IDS.userAnna, now, newId: () => uuidv7() };
  const row1 = { ...line, definition_html: legacy.html, definition_text: legacy.text, version: line.version + 1, updated_at: now, updated_by: ctx.actorId };
  const applied = await store().apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "entity", before: line, row: row1 }]));
  expect(applied.ok).toBe(true);
  // Sales Order: a long rich-text definition, written through the domain
  const order = entity("Sales Order");
  const long = Array.from({ length: 8 }, (_, i) => `<p>Paragraph ${i + 1} of the order's definition.</p>`).join("");
  await asPerson(SEED_IDS.userAnna, (c, access) =>
    updateEntity(c, access, { entity: order, entities: [], concept: null }, { entityId: order.id, expectedVersion: order.version, definition: long }),
  );

  await signInAs(page, "Łukasz");
  await openCanvas(page);

  await openEntityFromTree(page, "Order Line");
  await expect(page.getByTestId("field-entity-definition-view").locator("p")).toHaveText(["One product on one order.", "Quantity times price,less the discount. a < b & c"]);
  await expect(page.getByTestId("field-entity-definition-view").locator("br")).toHaveCount(1);
  await page.getByTestId("field-entity-definition-edit").click();
  await expect(page.getByTestId("text-rte-subtitle")).toHaveText("Entity definition");
  await expect(page.getByTestId("dialog-rich-text").getByRole("heading")).toHaveText("Order Line");
  await expect(page.getByTestId("rte-content").locator("p")).toHaveCount(2);
  await expect(page.getByTestId("rte-content").locator("p").nth(1)).toContainText("a < b & c");
  await expect(page.getByTestId("button-rte-template")).toHaveCount(0);
  await page.getByTestId("button-rte-cancel").click();
  await expect(page.getByTestId("dialog-rich-text")).toHaveCount(0);

  // an attribute's definition: the same editor, no template
  await row(page, "Customer", attribute("Customer", "email").id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("field-attribute-definition-view")).toHaveText("What this attribute means for the business. Click to write it.");
  await page.getByTestId("field-attribute-definition-view").click();
  await expect(page.getByTestId("text-rte-subtitle")).toHaveText("Attribute definition");
  await expect(page.getByTestId("dialog-rich-text").getByRole("heading")).toHaveText("Customer.email");
  await expect(page.getByTestId("button-rte-template")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dialog-rich-text")).toHaveCount(0);

  // a long definition is shortened with “Show more”
  await openEntityFromTree(page, "Sales Order");
  const view = page.getByTestId("field-entity-definition-view");
  await expect(view.locator("p")).toHaveCount(8);
  await expect(page.getByTestId("field-entity-definition-more")).toHaveText("Show more");
  await page.getByTestId("field-entity-definition-more").click();
  await expect(view).toHaveClass(/\bopen\b/);
  await expect(page.getByTestId("field-entity-definition-more")).toHaveText("Show less");
});
