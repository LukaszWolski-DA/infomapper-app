import { expect, test } from "./fixtures";
import { canvasUrl, dragTo, expectToast, ids, LEFT_AT_100, loadModel, openCanvas, rowNamed, signInAs } from "./helpers";

test("S1B-01: dragging customers.segment onto Customer.segment_code creates a direct mapping and its line", async ({ page }) => {
  const { attribute, column } = await ids();
  const segment = column("customers", "segment"), code = attribute("Customer", "segment_code");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);

  await dragTo(page, rowNamed(page, "customers", "segment"), rowNamed(page, "Customer", "segment_code"));
  await expectToast(page, "Mapped customers.segment to Customer.segment_code");

  const model = await loadModel();
  const created = model.mappings.filter((m) => m.attribute_id === code.id);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ kind: "direct", status: "draft" });
  expect(model.mappingInputs.filter((i) => i.mapping_id === created[0]!.id).map((i) => i.source_column_id)).toEqual([segment.id]);
  await expect(page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${created[0]!.id}"]`)).toHaveCount(1);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
});
