import { expect, test } from "./fixtures";
import {
  approvedMapping,
  attrId,
  cubeMappingId,
  gapsOf,
  hydrated,
  ids,
  lensRows,
  litModules,
  openAttribute,
  openRequirement,
  openStar,
  place,
  requirementByKey,
  signInAs,
  STAR,
  undoButton,
  veil,
} from "./helpers";
import { loadRequirementLinks } from "../slice-04a/helpers";

// S15-15 (X-5, D-70, IC-12): REQ-210's coverage through dimensional mappings. It reads 0 of 3 with the reasons of D5
// (option A's set at both levels); the lens colours its three rows and the four logical rows that feed them; Focus lights
// its cards, the feeding cards and only its own two dimensional lines. An approved source mapping onto the attribute
// behind Dim Customer.segment_code makes it 1 of 3 and its table lights under Focus. A link to Dim Product.sku from its
// panel, and its undo.

test("S15-15: REQ-210 covers 0 of 3; the lens and Focus follow its dimensional mappings to the logical model", async ({ page }) => {
  const { attribute } = await ids();
  const feeding = [attribute("Order Line", "quantity"), attribute("Order Line", "unit_price"), attribute("Order Line", "discount_pct"), attribute("Customer", "segment_code")].map((a) => a.id);
  const items = [attrId("sales.net_amount"), attrId("cust.segment_code"), attrId("date.month")];

  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText("0 of 3 covered");
  await expect.poll(() => gapsOf(page)).toEqual(["Dim Customer.segment_code logical feed not covered", "Dim Date.month not fed", "Fact Sales.net_amount not approved"]);

  // the lens: the three items and the four feeding rows, all gaps (no source mapping behind them)
  await expect.poll(() => lensRows(page, "gap")).toEqual([...items, ...feeding].sort());
  await expect.poll(() => lensRows(page, "covered")).toEqual([]);

  // Focus: Fact Sales, Dim Customer, Dim Date, Order Line and Customer; only REQ-210's two dimensional lines
  await page.getByTestId("button-focus").click();
  await expect.poll(async () => (await veil(page))?.litCards).toBe(5);
  await expect.poll(() => litModules(page)).toEqual([cubeMappingId("sales.net_amount"), cubeMappingId("cust.segment_code")].sort());
  await page.getByTestId("button-focus").click();
  await expect.poll(() => veil(page)).toBeNull();
});

test("S15-15: an approved source mapping behind segment_code covers it, its table lights; a link from a fact's attribute and its undo", async ({ page }) => {
  const { attribute, column } = await ids();
  await approvedMapping(attribute("Customer", "segment_code").id, column("customers", "segment").id);
  await place("customers", { x: 40, y: 900 }, STAR);

  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText("1 of 3 covered");
  await expect.poll(() => lensRows(page, "covered")).toEqual([attrId("cust.segment_code"), attribute("Customer", "segment_code").id].sort());
  await page.getByTestId("button-focus").click();
  await expect.poll(async () => (await veil(page))?.litCards).toBe(6); // and the table customers
  await page.getByTestId("button-focus").click();

  // a link to a dimension's attribute from its panel, as to a logical one; one undo takes it back
  const req = await requirementByKey("REQ-210");
  await openAttribute(page, "Dim Product", "sku");
  await page.getByTestId("select-link-requirement").selectOption(req.id);
  await expect.poll(async () => (await loadRequirementLinks()).filter((k) => k.requirement_id === req.id && k.deleted_at === null).length).toBe(4);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText(/^\d of 4 covered$/);
  await undoButton(page).click();
  await expect.poll(async () => (await loadRequirementLinks()).filter((k) => k.requirement_id === req.id && k.deleted_at === null).length).toBe(3);
  await expect(page.getByTestId("text-req-coverage")).toHaveText("1 of 3 covered");
});
