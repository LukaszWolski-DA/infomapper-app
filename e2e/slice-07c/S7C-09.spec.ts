// S7C-09 (the settings' and panels' part; the reading comes with step 5): Data Vault 2.0 mode switched off, the Data
// Vault classifications are hidden and stay stored, the message names their uses; switched on, they show again.

import { setClassification } from "../../src/domain/commands/classification";
import { expect, test } from "./fixtures";
import { asPerson, classesOf, classification, columnId, expectToast, groups, openColumn, RETAIL, SEED_IDS, setDataVault, signInAs, store, tableId, toggle } from "./helpers";

test("S7C-09: off hides the Data Vault classifications and keeps them, the message counts them; on shows them again", async ({ page }) => {
  await setDataVault(true);
  // test data: Link key on cust_no, Hub candidate on customers
  const custNo = await columnId("customers", "cust_no");
  const customers = await tableId("customers");
  for (const [code, target] of [["LK", { kind: "source_column", id: custNo }], ["T_HUB", { kind: "source_table", id: customers }]] as const) {
    const m = await store().model.load(RETAIL);
    const c = await classification(code);
    const r = await asPerson(SEED_IDS.userLukasz, (ctx, access) => setClassification(ctx, access, { classifications: m.classifications, links: m.classificationLinks, tables: m.sourceTables, columns: m.sourceColumns }, { classificationId: c.id, target, on: true }));
    expect(r.on).toBe(true);
  }
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}?tab=settings`);
  await expect(page.getByTestId("text-methodology")).toHaveText(
    "InfoMapper is methodology-neutral. The Data Vault 2.0 mode adds Data Vault classifications and a Data Vault reading to source table panels (hubs, links, satellites); nothing is generated or enforced.",
  );
  await page.getByTestId("checkbox-dv2").uncheck();
  await expectToast(page, "Data Vault 2.0 mode is off. 2 Data Vault classifications on tables and columns stay stored and show again when the mode is on.");

  await openColumn(page, "customers", "cust_no");
  await expect(groups(page)).toHaveText(["General"]);
  await expect(toggle(page, "Link key")).toHaveCount(0);
  expect(await classesOf(custNo)).toEqual(["BK", "LK"]);
  expect(await classesOf(customers)).toEqual(["T_HUB"]);

  await page.goto(`/w/${RETAIL}?tab=settings`);
  await page.getByTestId("checkbox-dv2").check();
  await expectToast(page, "Data Vault 2.0 mode is on.");
  await openColumn(page, "customers", "cust_no");
  await expect(groups(page)).toHaveText(["General", "Data Vault 2.0"]);
  await expect(toggle(page, "Link key")).toHaveAttribute("aria-pressed", "true");
});

test("S7C-09: with no Data Vault classification in use, switching off says only that", async ({ page }) => {
  await setDataVault(true);
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}?tab=settings`);
  await page.getByTestId("checkbox-dv2").uncheck();
  await expectToast(page, "Data Vault 2.0 mode is off.");
});

