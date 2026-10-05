import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, ids, LEFT_AT_100, loadModel, openCanvas, pickOption, rowNamed, signInAs } from "./helpers";

test("S1B-04: “Map to an attribute” in the column panel creates the mapping", async ({ page }) => {
  const { attribute, column } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);

  await rowNamed(page, "customers", "segment").click();
  const panel = page.getByTestId("panel-source-column");
  await expect(panel).toBeVisible();
  await pickOption(panel.getByTestId("select-map-to-attribute"), "segment_code");
  await expectToast(page, "Mapped customers.segment to Customer.segment_code");

  const model = await loadModel();
  const mapping = model.mappings.find((m) => m.attribute_id === attribute("Customer", "segment_code").id)!;
  expect(model.mappingInputs.filter((i) => i.mapping_id === mapping.id).map((i) => i.source_column_id)).toEqual([column("customers", "segment").id]);
  await expect(page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mapping.id}"]`)).toHaveCount(1);
});
