import { expect, test, type Page } from "./fixtures";
import { callActionDirectly, captureActionId, expectPanelVersion, openCanvas, openRequirement, requirementByKey, signInAs } from "./helpers";

const seg = (page: Page, testId: string, label: string) => page.getByTestId(testId).getByRole("button", { name: label, exact: true });
const pressed = (page: Page, testId: string) => page.getByTestId(testId).locator("[aria-pressed=true]");

test("S4A-03: every field of the requirement panel saves and survives a reload; a kind change keeps the check and severity; “Part of” offers no descendant and the server refuses a cycle; “Broken down into” links to the children", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-105");
  const r105 = await requirementByKey("REQ-105");

  const text = async (testId: string, value: string) => {
    await page.getByTestId(testId).fill(value);
    await page.getByTestId(testId).press("Enter");
  };
  await text("input-req-name", "Personal data is encrypted");
  await expect.poll(async () => (await requirementByKey("REQ-105")).name).toBe("Personal data is encrypted");
  await expectPanelVersion(page, "REQ-105");
  await text("input-req-owner", "Security officer");
  await expect.poll(async () => (await requirementByKey("REQ-105")).owner_name).toBe("Security officer");
  await expectPanelVersion(page, "REQ-105");
  await text("input-req-ref", "GDPR-32");
  await expect.poll(async () => (await requirementByKey("REQ-105")).external_ref).toBe("GDPR-32");
  await expectPanelVersion(page, "REQ-105");
  await seg(page, "seg-req-priority", "Could").click();
  await expect.poll(async () => (await requirementByKey("REQ-105")).priority).toBe("could");
  await expectPanelVersion(page, "REQ-105");
  await seg(page, "seg-req-status", "Implemented").click();
  await expect.poll(async () => (await requirementByKey("REQ-105")).status).toBe("implemented");
  await expectPanelVersion(page, "REQ-105");
  await page.getByTestId("select-req-parent").selectOption({ label: "REQ-101  Single view of the customer" });
  await expect.poll(async () => (await requirementByKey("REQ-105")).parent_id).toBe((await requirementByKey("REQ-101")).id);
  await expectPanelVersion(page, "REQ-105");
  // a data quality rule shows Check and “When it fails” (severity warn when it had none)
  await page.getByTestId("select-req-kind").selectOption("dq_rule");
  await expect.poll(async () => (await requirementByKey("REQ-105")).severity).toBe("warn");
  await expectPanelVersion(page, "REQ-105");
  await expect(page.getByText("Check", { exact: true })).toBeVisible();
  await page.getByTestId("input-req-expression").fill("encrypted = true");
  await page.getByTestId("input-req-expression").blur();
  await expect.poll(async () => (await requirementByKey("REQ-105")).expression).toBe("encrypted = true");
  await expectPanelVersion(page, "REQ-105");
  await seg(page, "seg-req-severity", "Block the load").click();
  await expect.poll(async () => (await requirementByKey("REQ-105")).severity).toBe("block");
  await expectPanelVersion(page, "REQ-105");
  await text("input-req-key", "REQ-150");
  await expect.poll(async () => (await requirementByKey("REQ-150"))?.id).toBe(r105.id);
  await expectPanelVersion(page, "REQ-150");
  await expectPanelVersion(page, "REQ-150");

  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await openRequirement(page, "REQ-150");
  await expect(page.getByTestId("input-req-name")).toHaveValue("Personal data is encrypted");
  await expect(page.getByTestId("select-req-kind")).toHaveValue("dq_rule");
  await expect(page.getByTestId("input-req-expression")).toHaveValue("encrypted = true");
  await expect(pressed(page, "seg-req-severity")).toHaveText("Block the load");
  await expect(pressed(page, "seg-req-status")).toHaveText("Implemented");
  await expect(pressed(page, "seg-req-priority")).toHaveText("Could");
  await expect(page.getByTestId("input-req-owner")).toHaveValue("Security officer");
  await expect(page.getByTestId("input-req-ref")).toHaveValue("GDPR-32");
  await expect(page.getByTestId("select-req-parent")).toHaveValue((await requirementByKey("REQ-101")).id);

  // REQ-103 as a business rule: Rule with the stored check, no “When it fails”; back as a data quality rule, both again
  await openRequirement(page, "REQ-103");
  await page.getByTestId("select-req-kind").selectOption("business_rule");
  await expect.poll(async () => (await requirementByKey("REQ-103")).kind).toBe("business_rule");
  await expectPanelVersion(page, "REQ-103");
  await expect(page.getByText("Rule", { exact: true })).toBeVisible();
  await expect(page.getByTestId("input-req-expression")).toHaveValue("COUNT(DISTINCT customer_id) per lower(email) = 1");
  await expect(page.getByTestId("seg-req-severity")).toHaveCount(0);
  await page.getByTestId("select-req-kind").selectOption("dq_rule");
  await expect.poll(async () => (await requirementByKey("REQ-103")).kind).toBe("dq_rule");
  await expectPanelVersion(page, "REQ-103");
  await expect(page.getByTestId("input-req-expression")).toHaveValue("COUNT(DISTINCT customer_id) per lower(email) = 1");
  await expect(pressed(page, "seg-req-severity")).toHaveText("Warn");

  // “Part of” for REQ-101 offers none of its descendants (REQ-102, REQ-103 and REQ-150 under it)
  await openRequirement(page, "REQ-101");
  const options = await page.getByTestId("select-req-parent").locator("option").allInnerTexts();
  expect(options).toEqual(["None (top level)", "REQ-104  Order total equals the sum of its lines"]);
  // a cycle sent directly is refused by the server
  const r101 = await requirementByKey("REQ-101"), r103 = await requirementByKey("REQ-103");
  const actionId = await captureActionId(page, async () => {
    await page.getByTestId("select-req-parent").selectOption({ label: "REQ-104  Order total equals the sum of its lines" });
  });
  await expect.poll(async () => (await requirementByKey("REQ-101")).version).toBe(r101.version + 1);
  await expectPanelVersion(page, "REQ-101");
  const body = await callActionDirectly(page, actionId, [r101.workspace_id, { requirementId: r101.id, expectedVersion: r101.version + 1, field: "parent_id", value: r103.id }]);
  expect(body).toContain("REQ-103 is already part of REQ-101, so REQ-101 cannot be part of it.");
  expect((await requirementByKey("REQ-101")).parent_id).toBe((await requirementByKey("REQ-104")).id);

  // “Broken down into” on REQ-101 links to REQ-102
  await expect(page.getByTestId("text-req-children")).toContainText("Broken down into");
  await page.getByTestId("link-req-child").filter({ hasText: "REQ-102" }).click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-102");
});
