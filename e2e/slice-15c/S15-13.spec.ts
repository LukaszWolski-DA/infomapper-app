import { expect, test } from "./fixtures";
import {
  attributeIdOf,
  cubeInputsOf,
  cubeMappingId,
  hydrated,
  liveCubeInputs,
  liveCubeMappings,
  model,
  openAttribute,
  openStar,
  recordToasts,
  rowNamed,
  signInAs,
  toasts,
  undoButton,
} from "./helpers";

// S15-13 (IC-11, X-3, Q-5, P10): Customer.segment_code's delete asks the second click, which names its dimensional
// mapping and Dim Customer's lost feed; after it Dim Customer.segment_code stays, unfed; the toast counts both kinds of
// mappings. An attribute that feeds nothing deletes at once, as before. Order Line.discount_pct is one of net_amount's
// three inputs: its delete takes that mapping whole (Q-5, X2). Each is one undo step.

test("S15-13: segment_code's second click names its feed; Dim Customer's attribute stays unfed; Q-5 with net_amount's three inputs", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const segment = await attributeIdOf("Customer", "segment_code");

  await openAttribute(page, "Customer", "segment_code");
  await expect(page.getByTestId("fold-cube-feeds")).toContainText("Dim Customer.segment_code");
  const del = page.getByTestId("button-delete-attribute");
  await del.click();
  await expect(del).toHaveText(/^Click again to delete, with (\d+ mappings? and )?1 dimensional mapping; Dim Customer loses its feed from the logical model$/);
  await del.click();
  await expect.poll(async () => (await model()).attributes.some((a) => a.id === segment && a.deleted_at === null)).toBe(false);
  await expect.poll(() => toasts(page)).toContainEqual(expect.stringMatching(/^Attribute deleted together with (\d+ mappings? and )?1 dimensional mapping$/));
  await expect(rowNamed(page, "Dim Customer", "segment_code")).toHaveCount(1);
  await expect(rowNamed(page, "Dim Customer", "segment_code").getByTestId("dot-mapped")).toHaveAttribute("title", "Not fed from the logical model");
  expect((await liveCubeMappings()).some((m) => m.id === cubeMappingId("cust.segment_code"))).toBe(false);
  await undoButton(page).click();
  await expect.poll(async () => (await liveCubeMappings()).some((m) => m.id === cubeMappingId("cust.segment_code"))).toBe(true);
  await expect(rowNamed(page, "Dim Customer", "segment_code").getByTestId("dot-mapped")).toHaveAttribute("title", "from Customer.segment_code");

  // an attribute that feeds nothing and has no mapping deletes at once
  const m = await model();
  // Customer Address has no source mapping; its city feeds Dim Customer, its street nothing
  const customer = m.entities.find((e) => e.name === "Customer Address" && e.deleted_at === null)!;
  const inputs = new Set((await liveCubeInputs()).map((i) => i.attribute_id));
  const plain = m.attributes.find((a) => a.entity_id === customer.id && a.deleted_at === null && !inputs.has(a.id) && !m.mappings.some((x) => x.deleted_at === null && x.attribute_id === a.id))!;
  await openAttribute(page, "Customer Address", plain.name);
  await expect(page.getByTestId("fold-cube-feeds")).toHaveCount(0);
  await page.getByTestId("button-delete-attribute").click();
  await expect.poll(async () => (await model()).attributes.some((a) => a.id === plain.id && a.deleted_at === null)).toBe(false);
  await undoButton(page).click();
  await expect.poll(async () => (await model()).attributes.some((a) => a.id === plain.id && a.deleted_at === null)).toBe(true);

  // Q-5: one of net_amount's three inputs goes with its attribute, so the mapping goes whole
  const net = cubeMappingId("sales.net_amount");
  expect(await cubeInputsOf(net)).toHaveLength(3);
  await openAttribute(page, "Order Line", "discount_pct");
  await del.click();
  await expect(del).toHaveText(/2 dimensional mappings; Fact Sales loses its feed from the logical model$/);
  await del.click();
  await expect.poll(async () => (await liveCubeMappings()).some((x) => x.id === net)).toBe(false);
  expect(await cubeInputsOf(net)).toHaveLength(0);
  await expect(rowNamed(page, "Fact Sales", "net_amount").getByTestId("dot-mapped")).toHaveAttribute("title", "Not fed from the logical model");
  await undoButton(page).click();
  await expect.poll(() => cubeInputsOf(net)).toHaveLength(3);
  await expect(rowNamed(page, "Fact Sales", "net_amount").getByTestId("dot-mapped")).toHaveAttribute("title", "from Order Line.quantity + Order Line.unit_price + Order Line.discount_pct");
});
