// S21-03 (slice 21, item 3, R6, D-70, D-76): in the requirement panel a logical attribute in scope whose approved
// mapping reads a column missing from the source, then a retired one, says "column left the source" instead of "not
// approved"; the counts are unchanged (D-31 counts no coverage from it, as before). A dimensional attribute's reasons do
// not change.

import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, starTest, test, type Page } from "./fixtures";
import { gapsOf, hydrated, loadModel, openCanvas, openRequirement, openStar, signInAs } from "./helpers";
import { loadRequirementLinks, requirementByKey } from "../slice-04a/helpers";

const coverageText = (page: Page) => page.getByTestId("text-req-coverage");

/** Marks columns as gone from the source in the e2e data file: missing, and retired when asked. */
async function leave(columnIds: readonly string[], retired = false): Promise<void> {
  const db = await readDb(E2E_DB);
  const at = new Date().toISOString();
  for (const c of db.source_column) if (columnIds.includes(c.id)) Object.assign(c, { missing_since: c.missing_since ?? at, retired_since: retired ? at : c.retired_since });
  await writeDb(E2E_DB, db);
}

test("S21-03: an approved mapping from a missing, then a retired column says “column left the source”; the counts unchanged", async ({ page }) => {
  // REQ-102 covers its three attributes through approved mappings (S4A-08)
  const req = (await requirementByKey("REQ-102"))!;
  const model = await loadModel();
  const attributeId = (await loadRequirementLinks()).find((k) => k.requirement_id === req.id && k.attribute_id && k.deleted_at === null)!.attribute_id!;
  const attribute = model.attributes.find((a) => a.id === attributeId)!;
  const entity = model.entities.find((e) => e.id === attribute.entity_id)!;
  const mapping = model.mappings.find((m) => m.attribute_id === attributeId && m.status === "approved" && m.deleted_at === null)!;
  const columns = model.mappingInputs.filter((i) => i.mapping_id === mapping.id && i.deleted_at === null).map((i) => i.source_column_id);
  const label = `${entity.name}.${attribute.name}`;

  await leave(columns);
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await hydrated(page);
  await openRequirement(page, "REQ-102");
  // the same count as an approved mapping that does not count, the reason its own
  await expect(coverageText(page)).toHaveText("2 of 3 covered");
  await expect.poll(() => gapsOf(page)).toEqual([`${label} column left the source`]);

  // retired as well (kept as historical, slice 7b)
  await leave(columns, true);
  await page.reload();
  await hydrated(page);
  await openRequirement(page, "REQ-102");
  await expect(coverageText(page)).toHaveText("2 of 3 covered");
  await expect.poll(() => gapsOf(page)).toEqual([`${label} column left the source`]);
});

starTest("S21-03: a dimensional attribute's reasons do not change", async ({ page }) => {
  // every column with an approved mapping leaves the source: REQ-210's reasons stay those of S15-15
  const model = await loadModel();
  const approved = new Set(model.mappings.filter((m) => m.status === "approved" && m.deleted_at === null).map((m) => m.id));
  await leave(model.mappingInputs.filter((i) => approved.has(i.mapping_id)).map((i) => i.source_column_id));
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(coverageText(page)).toHaveText("0 of 3 covered");
  await expect.poll(() => gapsOf(page)).toEqual(["Dim Customer.segment_code logical feed not covered", "Dim Date.month not fed", "Fact Sales.net_amount not approved"]);
});
