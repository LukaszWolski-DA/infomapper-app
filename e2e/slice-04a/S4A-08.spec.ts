import { createMapping, setMappingStatus } from "../../src/domain/commands/mapping";
import { createRequirement } from "../../src/domain/commands/requirement";
import { expect, test, type Page } from "./fixtures";
import { asPerson, ids, mappingId, openCanvas, openRequirement, requirementRow, SEED_IDS, signInAs, store, RETAIL } from "./helpers";

const coverageText = (page: Page) => page.getByTestId("text-req-coverage");
const gaps = (page: Page) => page.getByTestId("item-req-gap").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText.split("\n")[0]} ${(e as HTMLElement).dataset.why}`));

test("S4A-08: coverage: the seed's figures in the panel and the bars; approving a mapping into a gap attribute covers it; an approved direct mapping with a type conflict is a gap; a requirement traced only to a table shows 0 / 0; a click on a gap goes to the attribute", async ({ page }) => {
  // an approved direct mapping with a type conflict: order_line.item_code (varchar) → Order Line.quantity (integer)
  const { attribute, column, table } = await ids();
  const created = await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    createMapping(
      ctx,
      access,
      { attribute: attribute("Order Line", "quantity"), column: column("order_line", "item_code"), mappings: [], mappingInputs: [] },
      { attributeId: attribute("Order Line", "quantity").id, sourceColumnId: column("order_line", "item_code").id },
    ),
  );
  const conflict = (await store().model.load(RETAIL)).mappings.find((m) => m.id === created.mappingId)!;
  await asPerson(SEED_IDS.userPiotr, (ctx, access) =>
    setMappingStatus(ctx, access, { mapping: conflict, contentAuthorId: SEED_IDS.userAnna }, { mappingId: conflict.id, expectedVersion: conflict.version, status: "approved" }),
  );
  // a requirement traced only to a table
  await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    createRequirement(ctx, access, { requirements: [], sourceTables: [table("customers")] }, { link: { kind: "source_table", id: table("customers").id } }),
  );

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-101");
  await expect(coverageText(page)).toHaveText("5 / 8");
  await expect(gaps(page)).resolves.toEqual(["Customer.segment_code unmapped", "Customer.birth_date not approved", "Customer.created_at not approved"]);
  for (const [key, ok, total] of [["REQ-101", 5, 8], ["REQ-102", 3, 3], ["REQ-103", 1, 1], ["REQ-104", 1, 4], ["REQ-105", 3, 4], ["REQ-106", 0, 0]] as const) {
    await expect(requirementRow(page, key).getByTestId("bar-req-coverage")).toHaveAttribute("title", `${ok} of ${total} attributes covered`);
  }

  // the conflict makes quantity a gap: mapped, not approved
  await openRequirement(page, "REQ-104");
  await expect(coverageText(page)).toHaveText("1 / 4");
  await expect(gaps(page)).resolves.toEqual(["Order Line.unit_price unmapped", "Order Line.discount_pct unmapped", "Order Line.quantity not approved"]);

  // traced only to a table: no attribute in scope, not covered
  await openRequirement(page, "REQ-106");
  await expect(coverageText(page)).toHaveText("0 / 0");
  await expect(page.getByTestId("item-req-gap")).toHaveCount(0);

  // approving birth_date's mapping (in review) covers it: REQ-105 goes to 4 / 4
  await openRequirement(page, "REQ-105");
  await expect(coverageText(page)).toHaveText("3 / 4");
  await page.getByTestId("item-req-gap").filter({ hasText: "Customer.birth_date" }).click(); // a click on a gap goes to the attribute
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.locator(`[data-row="${attribute("Customer", "birth_date").id}"]`)).toHaveClass(/\bsel\b/);
  await page.getByTestId("list-attribute-mappings").getByText("customers.dob").click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await page.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved", exact: true }).click();
  const dob = await mappingId("customers.dob", "Customer.birth_date");
  await expect.poll(async () => (await store().model.load(RETAIL)).mappings.find((m) => m.id === dob)?.status).toBe("approved");
  await openRequirement(page, "REQ-105");
  await expect(coverageText(page)).toHaveText("4 / 4");
  await expect(page.getByTestId("item-req-gap")).toHaveCount(0);
  await expect(requirementRow(page, "REQ-105").getByTestId("bar-req-coverage")).toHaveAttribute("title", "4 of 4 attributes covered");
});
