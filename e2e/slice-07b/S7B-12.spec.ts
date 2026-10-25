// S7B-12: the derivation (P2; step 1 answers F1, F2, Q3): a data file from slice 7a (format 6) with columns missing
// from source and mappings an import sent back gets the matching open changes on its first read, each saying
// “Raised when slice 7b was installed.”, and is written back as format 7.

import fs from "node:fs";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { card, crmChanges, loadChanges, openSystem } from "./helpers";

/** The e2e data file as slice 7a wrote it: format 6, no changes to resolve and none of 7b's columns. */
function asFormat6() {
  const db = JSON.parse(fs.readFileSync(E2E_DB, "utf8")) as Record<string, unknown> & { change_event: { object_type: string }[] };
  db.format = 6;
  delete db.source_change;
  db.change_event = db.change_event.filter((e) => e.object_type !== "source_change");
  const strip = (rows: unknown, ...keys: string[]) => (rows as Record<string, unknown>[]).forEach((r) => keys.forEach((k) => delete r[k]));
  strip(db.source_table, "retired_since");
  strip(db.source_column, "retired_since", "not_needed");
  strip(db.source_import, "changes_raised", "changes_high");
  fs.writeFileSync(E2E_DB, JSON.stringify(db));
}

test("S7B-12: a format-6 file gets the open changes its imports left, marked as derived", async ({ page }) => {
  await crmChanges();
  asFormat6();

  await openSystem(page);
  const cards = page.getByTestId("panel-source-system").getByTestId("change-card");
  await expect(cards).toHaveCount(9);
  for (const detail of await cards.getByTestId("change-detail").allTextContents()) expect(detail).toMatch(/Raised when slice 7b was installed\.$/);
  await expect(card(page, "column_left", "dbo.customers.segment")).toBeVisible();
  await expect(card(page, "type_conflict", "dbo.customers.email_addr")).toHaveAttribute("data-severity", "high");
  await expect(card(page, "business_key_changed", "dbo.customers.cust_no")).toBeVisible();

  expect((JSON.parse(fs.readFileSync(E2E_DB, "utf8")) as { format: number }).format).toBe(7);
  expect((await loadChanges()).every((c) => c.source_import_id !== null)).toBe(true);
});
