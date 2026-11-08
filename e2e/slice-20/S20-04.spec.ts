// S20-04 (panels, PRD item 6, Z7, Z8): "Model checks" right after the kind line in the entity, attribute, relationship
// and dimensional mapping panels, with their own lines; an entity lists its attributes' lines; an attribute's own line
// shows only its detail; Fact Sales without a grain shows only "1 hint in the Fact section below."; an item naming
// another object selects it; a reader sees the same box.

import { SEED_USERS } from "../../src/data/local/seed";
import { updateCubeEntity } from "../../src/modules/infocube/domain/commands";
import { expect, test } from "./fixtures";
import { asCube, boxItems, clickCubeLine, cubeMappingId, canvasUrl, checksBox, clickLine, cubeRow, demoRel, entityIdOf, hydrated, openAttribute, openCanvas, openEntity, openStar, signInAs, WHOLE_CO } from "./helpers";

test("S20-04: the panels' box, its items and where they lead", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  // the entity: its attributes' lines, right after the kind line, orange (a High line)
  await openEntity(page, "Customer");
  const kindThenBox = await page.getByTestId("panel-entity").evaluate((p) => p.children[1]?.getAttribute("data-testid"));
  expect(kindThenBox).toBe("box-model-checks");
  await expect(checksBox(page)).toHaveAttribute("data-high", "true");
  // (a feed not yet covered is listed in its mapping's panel only, PRD item 6)
  await expect(boxItems(page)).toHaveText(["Keys copied the wrong way. Customer.last_order_id: copy of Sales Order.order_id, but Customer is the one side of “places”"]);
  // an item naming another object selects it: the attribute's panel, its own line as its detail only
  await boxItems(page).first().click();
  await expect(page.getByTestId("input-attribute-name")).toHaveValue("last_order_id");
  await expect(boxItems(page)).toHaveText(["Keys copied the wrong way. copy of Sales Order.order_id, but Customer is the one side of “places”"]);
  // an attribute without lines has no box
  await openAttribute(page, "Customer", "email");
  await expect(checksBox(page)).toHaveCount(0);

  // the relationship "places": the wrong way, listed there too (answer 7)
  await clickLine(page, demoRel("customer>order"));
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
  await expect(boxItems(page)).toHaveText(["Keys copied the wrong way. Customer.last_order_id: copy of Sales Order.order_id, but Customer is the one side of “places”"]);

  // a fact without a grain: only the count of its hints, which stay in the Fact section
  const sales = (await cubeRow(entityIdOf("sales")))!;
  await asCube(SEED_USERS.lukasz.id, (ctx, access) => updateCubeEntity(ctx, access, { cube: sales }, { cubeEntityId: sales.id, expectedVersion: sales.version, grain: null }));
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Fact Sales");
  await expect(checksBox(page).getByTestId("item-model-check-hints")).toHaveText("1 hint in the Fact section below.");
  await expect(boxItems(page)).toHaveCount(0);
  await expect(checksBox(page)).toContainText("Model checks1");

  // the dimensional mapping's own panel: its line, not clickable (it is the object shown)
  await clickCubeLine(page, cubeMappingId("prod.sku"));
  await expect(page.getByTestId("panel-cube-mapping")).toBeVisible();
  const kindThen = await page.getByTestId("panel-cube-mapping").evaluate((p) => p.children[1]?.getAttribute("data-testid"));
  expect(kindThen).toBe("box-model-checks");
  await expect(boxItems(page)).toHaveText(["Approved feeds over logical attributes not yet covered. Product.sku → Dim Product.sku: sku is not mapped"]);
  expect(await boxItems(page).first().evaluate((e) => e.tagName)).toBe("DIV");

  // a reader sees the same box
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await openEntity(page, "Sales Order");
  await expect(boxItems(page)).toHaveText(["Calculated and mapped. Sales Order.total_amount: calculated from 0, also 1 mapping"]);
});
