// S4B1-02 (slice 4b-1, PRD item 12; D-34): the element panels' indirect requirements. email shows its direct ones and no
// “via entity”; Customer shows REQ-101 directly and the attribute-linked ones “via attribute”; an attribute under a linked
// mapping shows it “via mapping”; a table shows the column- and mapping-linked ones; indirect rows have no ×.

import { expect, test } from "./fixtures";
import { ids, mappingId, openCanvas, openEntityFromTree, requirementLinkedTo, row, sectionRows, signInAs } from "./helpers";

test("S4B1-02: panels: email direct only plus via mapping, no via entity; Customer via attribute and via mapping; a table via column and via mapping; indirect rows have no ×", async ({ page }) => {
  const { attribute, column } = await ids();
  // REQ-106 on the mapping customers.email_addr → Customer.email; REQ-107 on the column customers.dob
  const onMapping = await requirementLinkedTo({ kind: "mapping", id: await mappingId("customers.email_addr", "Customer.email") });
  const onColumn = await requirementLinkedTo({ kind: "source_column", id: column("customers", "dob").id });
  expect([onMapping, onColumn]).toEqual(["REQ-106", "REQ-107"]);

  await signInAs(page, "Łukasz");
  await openCanvas(page);

  // email: its own (REQ-102, REQ-103, REQ-105), then the mapping's; REQ-101 (on Customer) does not come down
  await row(page, "Customer", attribute("Customer", "email").id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-102", "REQ-103", "REQ-105", "REQ-106 via mapping"]);
  await expect(page.locator('[data-testid="item-requirement"][data-via]').getByTestId("button-requirement-unlink")).toHaveCount(0);
  await expect(page.locator('[data-testid="item-requirement"]:not([data-via])').getByTestId("button-requirement-unlink")).toHaveCount(3);
  // an attribute with no requirement of its own and none on its mappings: nothing from its entity
  await row(page, "Customer", attribute("Customer", "segment_code").id).click();
  await expect.poll(() => sectionRows(page)).toEqual([]);

  // Customer: REQ-101 directly, its attributes' requirements via attribute, the mapping's via mapping (in the
  // requirements' order: by kind, then key; REQ-106 is a data requirement like REQ-102)
  await openEntityFromTree(page, "Customer");
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-101", "REQ-102 via attribute", "REQ-106 via mapping", "REQ-103 via attribute", "REQ-105 via attribute"]);
  await expect(page.locator('[data-testid="item-requirement"][data-via]').getByTestId("button-requirement-unlink")).toHaveCount(0);

  // the table customers: its column's requirement via column, the mapping reading its column via mapping
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-item").filter({ has: page.getByText("customers", { exact: true }) }).click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-106 via mapping", "REQ-107 via column"]);
  await expect(page.getByTestId("button-requirement-unlink")).toHaveCount(0);
});
