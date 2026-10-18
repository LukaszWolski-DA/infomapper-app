import { expect, test } from "./fixtures";
import { openCanvas, openRequirementsTab, requirementRow, signInAs } from "./helpers";

test("S4A-01: the Requirements tab: groups in kind order with counts, rows with icon, key, name and coverage bar; search; folding survives a reload; “on this canvas” shows the requirements with a card here (slice 4b-2); reviewers and readers have no “New requirement”", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirementsTab(page);

  const groups = page.getByTestId("tree-req-group");
  await expect(groups.getByTestId("tree-req-head")).toHaveText([/Business need\s*1/, /Data requirement\s*1/, /Business rule\s*1/, /Data quality rule\s*1/, /Non-functional\s*1/]);
  await expect(page.getByTestId("tree-req")).toHaveCount(5);
  const r104 = requirementRow(page, "REQ-104");
  await expect(r104).toContainText("REQ-104");
  await expect(r104).toContainText("Order total equals the sum of its lines");
  await expect(r104.locator("svg[data-kind=business_rule]")).toHaveCount(1);
  await expect(r104.getByTestId("bar-req-coverage")).toHaveAttribute("title", "1 of 4 covered (4 attributes)");
  await expect(requirementRow(page, "REQ-102").getByTestId("bar-req-coverage")).toHaveAttribute("title", "3 of 3 covered (3 attributes)");
  await expect(page.getByTestId("button-new-requirement")).toBeVisible();

  // search by key and name
  await page.getByTestId("input-tree-search").fill("e-mail");
  await expect(page.getByTestId("tree-req")).toHaveCount(1);
  await expect(requirementRow(page, "REQ-103")).toBeVisible();
  await page.getByTestId("input-tree-search").fill("req-105");
  await expect(page.getByTestId("tree-req")).toHaveText([/REQ-105/]);
  await page.getByTestId("input-tree-search").fill("");

  // folding a group is remembered in the browser
  await groups.filter({ hasText: "Business need" }).getByTestId("tree-req-head").click();
  await expect(requirementRow(page, "REQ-101")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await openRequirementsTab(page);
  await expect(requirementRow(page, "REQ-101")).toHaveCount(0);
  await expect(requirementRow(page, "REQ-102")).toBeVisible();

  // only the requirements with a card here: REQ-104's, seeded on this canvas (slice 4b-2, J)
  await page.getByTestId("check-canvas-only").check();
  await expect(page.getByTestId("tree-req")).toHaveCount(1);
  await expect(requirementRow(page, "REQ-104")).toHaveAttribute("data-presence", "here");
  await expect(page.getByTestId("text-req-empty")).toHaveCount(0);
  // both are browser preferences: back for the next people in this browser
  await page.getByTestId("check-canvas-only").uncheck();
  await groups.filter({ hasText: "Business need" }).getByTestId("tree-req-head").click();
  await expect(requirementRow(page, "REQ-101")).toBeVisible();

  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    await signInAs(page, name);
    await openCanvas(page);
    await openRequirementsTab(page);
    await expect(page.getByTestId("tree-req")).toHaveCount(5);
    await expect(page.getByTestId("button-new-requirement")).toHaveCount(0);
  }
});
