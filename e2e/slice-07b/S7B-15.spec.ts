// S7B-15: roles (F22, AD-05, AD-09): a reviewer sees the changes and may approve again and leave in review, but no
// action that changes the model; a reader sees the changes and no action; an archived workspace offers none; the
// server refuses each, called directly with the page's session. (Approving follows four-eyes: S7B-08, S7B-09.) A
// reviewer sees model consistency and the Changes view, and nothing there changes the model (Łukasz's answer to step 6).

import { archive } from "../slice-07a/helpers";
import { callActionDirectly, captureActionId } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { card, changeOf, crmChanges, expectToast, loadModel, openSystem, RETAIL, SEED_IDS, signInAs } from "./helpers";

test("S7B-15: a reviewer may answer the review only; a reader may only read; the server refuses the rest", async ({ page, browser }) => {
  await crmChanges();
  // the retire action's id, from Łukasz's own click
  await openSystem(page);
  const retireId = await captureActionId(page, () => card(page, "column_left", "dbo.customers.segment").getByTestId("change-action-retire").click());
  await expectToast(page, /^Retired: kept as historical/);
  const target = await changeOf("column_left", "customers.created_ts");
  const input = { changeId: target.id, expectedVersion: target.version };

  // the reviewer: approve again and leave in review, nothing that edits the model
  const reviewer = await browser.newPage();
  await openSystem(reviewer, "Piotr Wiśniewski");
  await expect(reviewer.getByTestId("change-card")).toHaveCount(8);
  await expect(card(reviewer, "business_key_changed", "dbo.customers.cust_no").getByTestId("change-action-approve")).toBeVisible();
  await expect(card(reviewer, "type_conflict", "dbo.customers.email_addr").getByTestId("change-action-leave")).toBeVisible();
  for (const a of ["retire", "move", "delete", "map", "not_needed", "split"]) await expect(reviewer.getByTestId(`change-action-${a}`)).toHaveCount(0);
  await expect(reviewer.getByTestId("button-approve-all")).toBeVisible();
  await callActionDirectly(reviewer, retireId, [(await changeOf("column_left", "customers.created_ts")).workspace_id, input]);
  expect((await changeOf("column_left", "customers.created_ts")).status).toBe("open");
  await reviewer.close();

  // the reader: every change, no action
  const reader = await browser.newPage();
  await openSystem(reader, "Kasia Zielińska");
  await expect(reader.getByTestId("change-card")).toHaveCount(8);
  await expect(reader.locator('[data-testid^="change-action-"]')).toHaveCount(0);
  await expect(reader.getByTestId("button-approve-all")).toHaveCount(0);
  await callActionDirectly(reader, retireId, [target.workspace_id, input]);
  expect((await changeOf("column_left", "customers.created_ts")).status).toBe("open");
  await reader.close();

  // archived: no action for the owner either, and the server refuses
  await archive();
  await page.reload();
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-system").filter({ hasText: "CRM" }).getByTestId("button-open-system").click();
  await expect(page.getByTestId("change-card")).toHaveCount(8);
  await expect(page.locator('[data-testid^="change-action-"]')).toHaveCount(0);
  await callActionDirectly(page, retireId, [target.workspace_id, input]);
  expect((await changeOf("column_left", "customers.created_ts")).status).toBe("open");
});

test("S7B-15: a reviewer sees model consistency and the Changes view, and nothing in them changes the model", async ({ page }) => {
  await crmChanges();
  const before = JSON.stringify(await loadModel());
  await signInAs(page, "Piotr Wiśniewski");
  // model consistency on the project home: the groups and the system's line, links only
  await page.goto(`/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`);
  const consistency = page.getByTestId("section-consistency");
  await expect(consistency.getByTestId("consistency-group").and(page.locator('[data-group="review"]'))).toBeVisible();
  await expect(consistency.getByTestId("consistency-group").and(page.locator('[data-group="systems"]'))).toContainText("CRM");
  await expect(consistency.locator("button, input, select, textarea")).toHaveCount(0);
  // a line opens CRM's panel on the canvas: answering the review only, no model edit
  await consistency.getByTestId("consistency-line").filter({ hasText: "CRM" }).click();
  await expect(page.getByTestId("panel-source-system")).toBeVisible();
  for (const a of ["retire", "move", "delete", "map", "not_needed", "split"]) await expect(page.getByTestId(`change-action-${a}`)).toHaveCount(0);
  await expect(page.getByTestId("button-reimport")).toHaveCount(0);
  // the Changes view: the button, the bar for an import, Close
  await page.getByTestId("import-entry").filter({ hasText: "crm_snapshot_2026-10-20.csv" }).getByTestId("button-show-touched").click();
  await expect(page.getByTestId("bar-changes")).toBeVisible();
  await expect(page.getByTestId("text-changes-counts")).toHaveText("3 tables, 3 mappings, 3 attributes");
  await page.getByTestId("button-changes-close").click();
  await page.getByTestId("button-changes").click();
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^lit:changes:open:/);
  await expect(page.getByTestId("chip-changes")).toBeVisible();
  expect(JSON.stringify(await loadModel())).toBe(before);
});
