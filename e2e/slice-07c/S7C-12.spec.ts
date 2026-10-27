// S7C-12: the Data Vault reading: each line on test tables made for it; missing, retired and not needed columns left
// out; the empty text; a renamed classification still read. Shown in the table panel in Data Vault 2.0 mode only.

import { expect, test } from "./fixtures";
import { buildWriteSet } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { classify, columnId, openTable, RETAIL, renameBuiltin, SEED_IDS, setDataVault, store, tableId } from "./helpers";

/** Test data: a column's status set directly (missing, retired, not needed). */
async function setColumn(table: string, column: string, patch: Record<string, unknown>) {
  const s = store();
  const id = await columnId(table, column);
  const before = (await s.model.load(RETAIL)).sourceColumns.find((c) => c.id === id)!;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const row = { ...before, ...patch, version: before.version + 1, updated_at: ctx.now, updated_by: ctx.actorId };
  const applied = await s.apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "source_column", before, row }]));
  if (!applied.ok) throw new Error(applied.error.message);
}
const col = async (table: string, column: string) => ({ kind: "source_column" as const, id: await columnId(table, column) });

test("S7C-12: every line of the reading, on the customers and customer_addresses tables", async ({ page }) => {
  await setDataVault(true);
  // customers: cust_no Business key (seed), fname/lname/email_addr/dob Personal data (seed); segment Dependent child key,
  // created_ts Effective date, updated_ts Load date, and a Hub candidate on the table
  await classify("DCK", await col("customers", "segment"));
  await classify("EFF", await col("customers", "created_ts"));
  await classify("LDTS", await col("customers", "updated_ts"));
  await classify("DK", await col("customers", "email_addr"));
  await classify("MAK", await col("customers", "lname"));
  await openTable(page, "customers", "cust_no");
  const reading = page.getByTestId("section-dv-reading");
  await expect(reading.getByTestId("dv-reading-line")).toHaveText([
    "Hub on cust_no",
    "Dependent child key segment: part of the link’s or satellite’s key, not a hub",
    "Driving key email_addr: an effectivity satellite on the link tracks it",
    "Multi-active satellite keyed by lname",
    "Effective-dated by created_ts",
    "Satellite with 3 descriptive columns; 2 with personal data: consider a separate satellite for fname, dob",
  ]);
  await expect(reading).toContainText("Hints from the classifications and the source’s keys; nothing is created.");

  // customer_addresses: its foreign key to customers, not marked Link key; then marked; a Link key with no relationship
  await page.getByTestId("panel-source-table").getByTestId("table-relationship").first().click();
  await expect(page.getByTestId("panel-source-table").locator("h2")).toHaveText("customer_addresses");
  await expect(reading.getByTestId("dv-reading-line").first()).toHaveText("Link to customers via cust_id (foreign key; not marked Link key)");
  await classify("LK", await col("customer_addresses", "cust_id"));
  await classify("LK", await col("customer_addresses", "zip"));
  await openTable(page, "customer_addresses", "cust_id");
  await expect(reading.getByTestId("dv-reading-line")).toHaveText([
    "Link to customers via cust_id",
    "Link key zip with no relationship known: which table does it point to?",
    "Satellite with 3 descriptive columns; 1 with personal data: consider a separate satellite for street_line1",
  ]);
});

test("S7C-12: missing, retired and not needed columns left out; a renamed classification still read; the empty text; only in the mode", async ({ page }) => {
  await setDataVault(true);
  const at = new Date().toISOString();
  await setColumn("customers", "fname", { missing_since: at });
  await setColumn("customers", "lname", { missing_since: at, retired_since: at });
  await setColumn("customers", "dob", { not_needed: true });
  await renameBuiltin("BK", "Klucz biznesowy");
  await openTable(page, "customers", "cust_no");
  const lines = page.getByTestId("section-dv-reading").getByTestId("dv-reading-line");
  await expect(lines).toHaveText(["Hub on cust_no", "Satellite with 4 descriptive columns; 1 with personal data: consider a separate satellite for email_addr"]);

  // a table with nothing to read: web_users with only its primary key left (the others not needed)
  for (const c of ["email", "cust_no", "registered_at"]) await setColumn("web_users", c, { not_needed: true });
  await openTable(page, "web_users", "user_id");
  await expect(page.getByTestId("section-dv-reading")).toContainText("Classify columns (Business key, Link key…) to see what this table suggests.");

  await setDataVault(false);
  await openTable(page, "customers", "cust_no");
  await expect(page.getByTestId("section-dv-reading")).toHaveCount(0);
  expect(await tableId("customers")).toBeTruthy();
});
