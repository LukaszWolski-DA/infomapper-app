// S4B1-01 (slice 4b-1, PRD items 9–10): scope and coverage count items. The seed's figures as agreed in step 1; an entity
// link is one item, covered once one of its attributes has an approved, type-correct mapping; an attribute link does not
// add its entity as an item; a mapping link adds its attribute; a requirement linked only to a table shows 0 / 0 and is
// not covered. The unit tests are in src/domain/model/requirements.test.ts.

import { expect, test, type Page } from "./fixtures";
import { approvedMapping, ids, mappingId, openCanvas, openRequirement, requirementLinkedTo, requirementRow, signInAs } from "./helpers";

const coverageText = (page: Page) => page.getByTestId("text-req-coverage");
const bar = (page: Page, key: string) => requirementRow(page, key).getByTestId("bar-req-coverage");

test("S4B1-01: coverage counts items: the seed's figures; an entity link is one item, covered after one approved type-correct mapping; an attribute link does not add its entity; a mapping link adds its attribute; a table-only requirement is 0 / 0", async ({ page }) => {
  const { entity, attribute, column, table } = await ids();
  const orderLine = await requirementLinkedTo({ kind: "entity", id: entity("Order Line").id });
  const unitPrice = await requirementLinkedTo({ kind: "attribute", id: attribute("Order Line", "unit_price").id });
  const viaMapping = await requirementLinkedTo({ kind: "mapping", id: await mappingId("customers.email_addr", "Customer.email") });
  const tableOnly = await requirementLinkedTo({ kind: "source_table", id: table("customers").id });

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-101");
  // the seed's figures (step 1, Q5): only REQ-101 moved, from 5 / 8 to one covered entity item
  for (const [key, title] of [
    ["REQ-101", "1 of 1 covered (1 entity)"],
    ["REQ-102", "3 of 3 covered (3 attributes)"],
    ["REQ-103", "1 of 1 covered (1 attribute)"],
    ["REQ-104", "1 of 4 covered (4 attributes)"],
    ["REQ-105", "3 of 4 covered (4 attributes)"],
  ] as const) {
    await expect(bar(page, key)).toHaveAttribute("title", title);
  }

  // an entity link: one item; Order Line has no covered attribute (product_id's mapping is not approved)
  await openRequirement(page, orderLine);
  await expect(coverageText(page)).toHaveText("0 of 1 covered");
  await expect(coverageText(page)).toHaveAttribute("title", "1 entity");
  // an approved mapping with a type conflict (order_line.item_code varchar → quantity integer) does not cover it
  await approvedMapping(attribute("Order Line", "quantity").id, column("order_line", "item_code").id);
  await page.reload();
  await openRequirement(page, orderLine);
  await expect(coverageText(page)).toHaveText("0 of 1 covered");
  // a type-correct one on another attribute (order_line.price decimal → unit_price decimal) does
  await approvedMapping(attribute("Order Line", "unit_price").id, column("order_line", "price").id);
  await page.reload();
  await openRequirement(page, orderLine);
  await expect(coverageText(page)).toHaveText("1 of 1 covered");
  await expect(bar(page, orderLine)).toHaveAttribute("title", "1 of 1 covered (1 entity)");

  // an attribute link does not add its entity as an item: unit_price alone, covered by the mapping above
  await openRequirement(page, unitPrice);
  await expect(coverageText(page)).toHaveText("1 of 1 covered");
  await expect(coverageText(page)).toHaveAttribute("title", "1 attribute");

  // a mapping link adds its attribute (email, covered)
  await openRequirement(page, viaMapping);
  await expect(coverageText(page)).toHaveText("1 of 1 covered");
  await expect(coverageText(page)).toHaveAttribute("title", "1 attribute");

  // only a table: no items, 0 / 0, not covered
  await openRequirement(page, tableOnly);
  await expect(coverageText(page)).toHaveText("0 of 0 covered");
  await expect(bar(page, tableOnly)).toHaveAttribute("title", "0 of 0 covered");
  // covered: REQ-101, 102, 103, the Order Line one, unit_price's and the mapping's; not REQ-104, 105 or the table's
  await expect(page.getByTestId("status-requirements")).toHaveText("Requirements 9, covered 6");
});
