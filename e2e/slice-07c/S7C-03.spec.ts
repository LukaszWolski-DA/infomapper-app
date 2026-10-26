// S7C-03: toggles: a column and a table classification set and cleared from the panels, each one undo step; the Data
// Vault group only in Data Vault 2.0 mode; disabled for a reviewer and a reader; the server refuses their writes.

import { expect, test } from "./fixtures";
import { callActionDirectly, captureActionId, classesOf, classification, columnId, expectPressed, groups, openColumn, openTable, RETAIL, setDataVault, tableId, toggle, undo } from "./helpers";

test("S7C-03: a column's and a table's classification set and cleared, each one undo step; the groups", async ({ page }) => {
  await openColumn(page, "customers", "segment");
  const segment = await columnId("customers", "segment");
  await expect(groups(page)).toHaveText(["General"]);
  await expect(page.getByTestId("section-classifications")).toContainText("Yours: a re-import never changes them.");

  await toggle(page, "Technical / audit").click();
  await expectPressed(page, "Technical / audit", true);
  await expect.poll(() => classesOf(segment)).toEqual(["TECH"]);
  await undo(page);
  await expectPressed(page, "Technical / audit", false);
  await expect.poll(() => classesOf(segment)).toEqual([]);
  await toggle(page, "Load date").click();
  await expectPressed(page, "Load date", true);
  await toggle(page, "Load date").click();
  await expectPressed(page, "Load date", false);
  await expect.poll(() => classesOf(segment)).toEqual([]);
  await undo(page);
  await expectPressed(page, "Load date", true);

  // a table's classifications are the table ones
  await page.getByTestId("panel-source-column").getByRole("button", { name: "customers", exact: true }).click();
  await expect(page.getByTestId("panel-source-table").getByTestId("toggle-classification")).toHaveText(["Master data", "Transactions", "Reference / code list", "Staging", "Log / audit", "History (SCD2)"]);
  await toggle(page, "Master data").click();
  await expectPressed(page, "Master data", true);
  await expect.poll(async () => classesOf(await tableId("customers"))).toEqual(["T_MASTER"]);
  await undo(page);
  await expectPressed(page, "Master data", false);
  await expect.poll(async () => classesOf(await tableId("customers"))).toEqual([]);
});

test("S7C-03: the Data Vault 2.0 group only in Data Vault 2.0 mode", async ({ page }) => {
  await setDataVault(true);
  await openTable(page, "customers", "cust_no");
  await expect(groups(page)).toHaveText(["General", "Data Vault 2.0"]);
  await expect(toggle(page, "Hub candidate")).toBeVisible();
  await page.getByTestId("panel-source-table").getByTestId("list-table-columns").getByText("cust_no", { exact: true }).click();
  await expect(groups(page)).toHaveText(["General", "Data Vault 2.0"]);
  await expect(toggle(page, "Link key")).toBeVisible();
  await setDataVault(false);
  await openColumn(page, "customers", "cust_no");
  await expect(groups(page)).toHaveText(["General"]);
  await expect(toggle(page, "Link key")).toHaveCount(0);
});

test("S7C-03: disabled for a reviewer and a reader; the server refuses their writes", async ({ page, browser }) => {
  await openColumn(page, "customers", "segment");
  const segment = await columnId("customers", "segment");
  const setId = await captureActionId(page, () => toggle(page, "Technical / audit").click());
  await expectPressed(page, "Technical / audit", true);
  const tech = (await classification("TECH")).id;
  const input = { classificationId: tech, target: { kind: "source_column", id: segment }, on: false };
  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const other = await browser.newPage();
    await openColumn(other, "customers", "segment", name);
    await expect(toggle(other, "Technical / audit")).toBeDisabled();
    await expect(toggle(other, "Technical / audit")).toHaveAttribute("aria-pressed", "true");
    await callActionDirectly(other, setId, [RETAIL, input]);
    expect(await classesOf(segment)).toEqual(["TECH"]);
    await other.close();
  }
});
