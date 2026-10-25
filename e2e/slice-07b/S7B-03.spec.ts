// S7B-03: changes the source settles (P7, item 7): a table that comes back after it was retired loses `retired_since`;
// a column that comes back settles its open “left” change; a new column that leaves before a decision settles its
// change; each with its resolution in the system panel's history.

import { expect, test } from "./fixtures";
import { act, changeOf, column, crmPartial, importAs, openSystem, sample, SEED_IDS, table, today } from "./helpers";

const LUKASZ = SEED_IDS.userLukasz;

test("S7B-03: what comes back loses retired and settles its change; the history says so", async ({ page }) => {
  await importAs(LUKASZ, "CRM", "crm_partial.tsv", crmPartial());
  await openSystem(page);
  await act(page, "table_left", "dbo.customer_addresses", "retire", "Retired: kept as historical: dbo.customer_addresses");
  expect((await table("customer_addresses")).retired_since).not.toBeNull();

  // the unchanged CRM brings both back
  await importAs(LUKASZ, "CRM", "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  const addresses = await table("customer_addresses");
  expect([addresses.missing_since, addresses.retired_since]).toEqual([null, null]);
  expect((await column("customer_addresses", "city")).retired_since).toBeNull();
  const segment = await changeOf("column_left", "customers.segment");
  expect(segment).toMatchObject({ status: "resolved", resolution: `Back in the source on ${today()}` });

  await openSystem(page);
  const history = page.getByTestId("changes-resolved");
  await history.locator("summary").click();
  await expect(history.getByTestId("resolved-change").filter({ hasText: "dbo.customers.segment" })).toContainText(`Back in the source on ${today()} · Łukasz`);
  await expect(history.getByTestId("resolved-change").filter({ hasText: "dbo.customer_addresses" })).toContainText("Retired: kept as historical");
  await expect(page.getByTestId("changes-none")).toBeVisible();
});

test("S7B-03: a new column that leaves before a decision settles its change", async ({ page }) => {
  await importAs(LUKASZ, "CRM", "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  expect((await changeOf("new_column", "customers.consent_flag")).status).toBe("open");
  await importAs(LUKASZ, "CRM", "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  expect(await changeOf("new_column", "customers.consent_flag")).toMatchObject({ status: "resolved", resolution: `Left the source on ${today()} before a decision` });

  await openSystem(page);
  const history = page.getByTestId("changes-resolved");
  await history.locator("summary").click();
  await expect(history.getByTestId("resolved-change").filter({ hasText: "dbo.customers.consent_flag" })).toContainText("before a decision");
});
