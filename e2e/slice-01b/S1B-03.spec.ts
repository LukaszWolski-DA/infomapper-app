import { expect, test } from "./fixtures";
import { canvasUrl, card, dragTo, expectToast, ids, loadModel, openCanvas, rowNamed, signInAs } from "./helpers";

test("S1B-03: dropping order_line.price on the Order Line header creates attribute price (decimal with the column's precision and scale) and a direct mapping", async ({ page }) => {
  const { entity, column } = await ids();
  const line = entity("Order Line"), price = column("order_line", "price");
  await signInAs(page, "Łukasz");
  // Order Line (840, 568) and order_line (1176, 600) in view at 100%
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });

  await dragTo(page, rowNamed(page, "order_line", "price"), card(page, "Order Line").locator(".c-head"));
  await expectToast(page, "Added price to Order Line, mapped from order_line.price. Rename it on the right.");

  const model = await loadModel();
  const attr = model.attributes.find((a) => a.entity_id === line.id && a.name === "price")!;
  expect(attr).toMatchObject({ data_type: "decimal", type_precision: 10, type_scale: 2 });
  const mapping = model.mappings.filter((m) => m.attribute_id === attr.id);
  expect(mapping).toHaveLength(1);
  expect(mapping[0]!.kind).toBe("direct");
  expect(model.mappingInputs.filter((i) => i.mapping_id === mapping[0]!.id).map((i) => i.source_column_id)).toEqual([price.id]);
  await expect(rowNamed(page, "Order Line", "price")).toHaveCount(1);
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
});
