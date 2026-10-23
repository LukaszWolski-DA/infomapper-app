// S7A-14, the review in parts (step 5, decision 1; Łukasz's condition on step 5): the filter counts and the P6 callout
// count the whole plan, not only the table cards rendered. A synthetic system of 160 tables (1,600 columns) is imported
// through the upload route; two of its last tables get approved mappings on their business key; the re-import changes
// one column in every table and the two keys' types, so 162 changes in 160 cards, of which the review renders 100.

import { importStateOf } from "../../src/domain/commands/import";
import { planFingerprint } from "../../src/domain/import/compare";
import { buildPlan } from "../../src/domain/import/plan";
import { readStandard } from "../../src/domain/import/standard";
import { approvedMapping } from "../slice-04b1/helpers";
import { syntheticStandard } from "../../scripts/lib/import-synthetic";
import { expect, test } from "./fixtures";
import { filterCount, loadModel, openWizard, RETAIL, reviewFile, signInAs } from "./helpers";

const TABLES = 160;
const KEYED = [139, 159]; // in schema s19, the last one: past the first 100 cards in any order
const name = (t: number) => `table_${String(t).padStart(5, "0")}`;

test("S7A-14 (counts): a review rendered in parts counts every change and every send-back", async ({ page }) => {
  test.setTimeout(240_000);
  await signInAs(page, "Łukasz");
  const text = syntheticStandard(TABLES);
  const read = readStandard(text, "synth.csv");
  const scope = read.tables.map((t) => t.key);
  const choices = { scope: new Set(scope), compare: "schemas" as const, renames: new Map() };
  const plan = buildPlan(importStateOf(await loadModel()).model, read, { newName: "Synth" }, choices);
  const response = await page.request.post(`/w/${RETAIL}/import`, {
    data: { target: { newName: "Synth" }, channel: "file", sourceLabel: "synth.csv", text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) },
  });
  expect((await response.json()).ok).toBe(true);

  const model = await loadModel();
  const attribute = model.attributes.find((a) => a.name === "customer_number")!;
  for (const t of KEYED) {
    const table = model.sourceTables.find((x) => x.name === name(t))!;
    const code = model.sourceColumns.find((c) => c.source_table_id === table.id && c.name === "code")!;
    await approvedMapping(attribute.id, code.id);
  }

  // every table: column 3 changes type; the two keyed tables: their business key too
  const changed = syntheticStandard(TABLES, undefined, (t, c) => (c === 3 || (c === 1 && KEYED.includes(t)) ? "change" : "keep"));
  await openWizard(page);
  await reviewFile(page, { existing: "Synth" }, "synth-changed.csv", changed);
  await expect(page.getByTestId("review-table")).toHaveCount(100);
  await expect(page.getByTestId("button-more-tables")).toContainText("Show the next 60 tables of 160");
  expect(await filterCount(page, "all")).toBe(TABLES + KEYED.length);
  expect(await filterCount(page, "changed")).toBe(TABLES + KEYED.length);
  for (const f of ["new", "rename", "missing", "rel"]) expect(await filterCount(page, f)).toBe(0);
  // the two keyed tables are not among the cards rendered, yet the callout names both
  for (const t of KEYED) await expect(page.getByTestId("review-table").filter({ hasText: name(t) })).toHaveCount(0);
  await expect(page.getByTestId("callout-send-back")).toContainText("2 approved mappings go back to review after this import");
  await expect(page.getByTestId("callout-send-back").locator("li")).toHaveCount(2);
});
