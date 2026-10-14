import { linkRequirement } from "../../src/domain/commands/requirement";
import { expect, test } from "./fixtures";
import { asPerson, ids, loadModel, loadRequirementLinks, mappingId, openCanvas, openEntityFromTree, requirementByKey, row, sectionRows, SEED_IDS, signInAs } from "./helpers";

test("S4A-07: indirect requirements: email shows REQ-102, REQ-103, REQ-105 directly and REQ-101 via entity; Customer shows REQ-101 directly and the others via attribute; a table under a linked mapping shows it via column; indirect rows have no ×", async ({ page }) => {
  // REQ-104 linked to the mapping customers.email_addr → Customer.email, through the domain
  const r104 = await requirementByKey("REQ-104");
  const target = { kind: "mapping" as const, id: await mappingId("customers.email_addr", "Customer.email") };
  const model = await loadModel();
  const links = await loadRequirementLinks();
  await asPerson(SEED_IDS.userAnna, (ctx, access) => linkRequirement(ctx, access, { requirement: r104, links, ...model }, { requirementId: r104.id, target }));

  const { attribute } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page);

  await row(page, "Customer", attribute("Customer", "email").id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-102", "REQ-103", "REQ-105", "REQ-101 via entity"]);
  await expect(page.locator('[data-testid="item-requirement"][data-via]').getByTestId("button-requirement-unlink")).toHaveCount(0);
  await expect(page.locator('[data-testid="item-requirement"]:not([data-via])').getByTestId("button-requirement-unlink")).toHaveCount(3);

  await openEntityFromTree(page, "Customer");
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-101", "REQ-102 via attribute", "REQ-104 via attribute", "REQ-103 via attribute", "REQ-105 via attribute"]);
  await expect(page.locator('[data-testid="item-requirement"][data-via]').getByTestId("button-requirement-unlink")).toHaveCount(0);

  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-item").filter({ has: page.getByText("customers", { exact: true }) }).click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await expect.poll(() => sectionRows(page)).toEqual(["REQ-104 via column"]);
  await expect(page.getByTestId("button-requirement-unlink")).toHaveCount(0);
});
