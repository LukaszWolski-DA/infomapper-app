import { expect, test, type Page } from "./fixtures";
import {
  callActionDirectly,
  captureActionId,
  expectToast,
  ids,
  loadRequirementLinks,
  loadRequirements,
  mappingId,
  openCanvas,
  openEntityFromTree,
  openRequirement,
  pickOption,
  requirementByKey,
  row,
  signInAs,
  tracesOf,
} from "./helpers";

const linkSelect = (page: Page) => page.getByTestId("select-link-requirement");

test("S4A-06: linking from each of the five element panels (a toast per type); the same link twice is “Already linked.” and writes nothing; “+ New requirement…” on email makes REQ-106 linked to it (one undo removes both); × in the element panel and in Traces to unlink (“Unlinked.”, one undo each)", async ({ page }) => {
  const { entity, attribute, table, column } = await ids();
  const email = attribute("Customer", "email");
  const emailMapping = await mappingId("customers.email_addr", "Customer.email");
  await signInAs(page, "Łukasz");
  await openCanvas(page);

  // entity
  await openEntityFromTree(page, "Customer");
  await pickOption(linkSelect(page), "REQ-104");
  await expectToast(page, "Linked REQ-104 to the entity.");
  // attribute
  await row(page, "Customer", email.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await pickOption(linkSelect(page), "REQ-104");
  await expectToast(page, "Linked REQ-104 to the attribute.");
  // mapping (from the attribute's “Comes from”)
  await page.getByTestId("list-attribute-mappings").getByText("customers.email_addr").click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await pickOption(linkSelect(page), "REQ-104");
  await expectToast(page, "Linked REQ-104 to the mapping.");
  // table
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-item").filter({ has: page.getByText("customers", { exact: true }) }).click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await pickOption(linkSelect(page), "REQ-104");
  await expectToast(page, "Linked REQ-104 to the table.");
  // column (from the table's column list); the action's id, to send the same link again
  await page.getByTestId("list-table-columns").getByText("email_addr", { exact: true }).click();
  await expect(page.getByTestId("panel-source-column")).toBeVisible();
  const linkAction = await captureActionId(page, () => pickOption(linkSelect(page), "REQ-104"));
  await expectToast(page, "Linked REQ-104 to the column.");

  const traced = [entity("Customer").id, email.id, emailMapping, table("customers").id, column("customers", "email_addr").id];
  const before = [...(await tracesOf("REQ-104"))];
  for (const id of traced) expect(before).toContain(id);

  // the same link again, sent directly: refused, nothing written
  const r104 = await requirementByKey("REQ-104");
  const linksBefore = (await loadRequirementLinks()).length;
  const body = await callActionDirectly(page, linkAction, [r104.workspace_id, { requirementId: r104.id, target: { kind: "source_column", id: column("customers", "email_addr").id } }]);
  expect(body).toContain("Already linked.");
  expect((await loadRequirementLinks()).length).toBe(linksBefore);

  // “+ New requirement…” on email: REQ-106 linked to it, its panel open; one undo removes both
  await row(page, "Customer", email.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await linkSelect(page).selectOption("__new__");
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-106");
  await expect(page.getByTestId("input-req-name")).toBeFocused();
  expect(await tracesOf("REQ-106")).toEqual([email.id]);
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await loadRequirements()).some((r) => r.key === "REQ-106")).toBe(false);
  expect((await loadRequirementLinks()).length).toBe(linksBefore);

  // × in the element panel: REQ-102 off email; one undo brings it back
  await row(page, "Customer", email.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await page.locator('[data-testid="item-requirement"][data-key="REQ-102"]').getByTestId("button-requirement-unlink").click();
  await expectToast(page, "Unlinked.");
  await expect.poll(async () => (await tracesOf("REQ-102")).includes(email.id)).toBe(false);
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await tracesOf("REQ-102")).includes(email.id)).toBe(true);

  // × in Traces to: REQ-103 off email; one undo brings it back
  await openRequirement(page, "REQ-103");
  await page.getByTestId("item-req-trace").getByTestId("button-trace-unlink").click();
  await expectToast(page, "Unlinked.");
  await expect.poll(() => tracesOf("REQ-103")).toEqual([]);
  await page.getByTestId("button-undo").click();
  await expect.poll(() => tracesOf("REQ-103")).toEqual([email.id]);
});
