// Slice 7a, step 4: the import's upload route (src/app/w/[workspaceId]/import/route.ts) before the wizard uses it
// (step 5). S7A-04's write through the server, S7A-12's refusal, P8, and a body larger than the proxy's default 10 MB.

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { createLocalDataStore } from "../../src/data/local/store";
import { importStateOf } from "../../src/domain/commands/import";
import { planFingerprint } from "../../src/domain/import/compare";
import { buildPlan, type ImportTarget } from "../../src/domain/import/plan";
import { readStandard } from "../../src/domain/import/standard";
import { E2E_DB } from "../config";
import { loadModel, RETAIL, signInAs } from "../slice-01a/helpers";
import { expect, test } from "./fixtures";
import { archive } from "./helpers";

const sample = (name: string) => fs.readFileSync(path.resolve("src", "domain", "import", "samples", name), "utf8");

/** What the review would send for a file, as the domain plans it from the e2e data file. */
async function inputFor(text: string, target: ImportTarget, name: string) {
  const read = readStandard(text, name);
  const scope = read.tables.map((t) => t.key);
  const plan = buildPlan(importStateOf(await loadModel()).model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
  return { target, channel: "file", sourceLabel: name, text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) };
}

const post = async (page: Page, data: unknown) => {
  const response = await page.request.post(`/w/${RETAIL}/import`, { data });
  return { status: response.status(), body: await response.json() };
};

test("S7A-04 (route): HR into a new system through the upload route: one change group, the import recorded", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const { status, body } = await post(page, await inputFor(sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }, "hr_snapshot_2026-10-20.csv"));
  expect(status).toBe(200);
  expect(body).toMatchObject({ ok: true, value: { systemName: "HR", summary: "2 new tables, 10 new columns, 2 new relationships", sentBack: 0 } });
  const model = await loadModel();
  const hr = model.sourceSystems.find((s) => s.name === "HR")!;
  expect(model.sourceTables.filter((t) => t.source_system_id === hr.id).map((t) => t.name).sort()).toEqual(["departments", "employees"]);
  const hrTables = new Set(model.sourceTables.filter((t) => t.source_system_id === hr.id).map((t) => t.id)); // the seed has CRM's and ERP's too
  expect(model.sourceRelationships.filter((r) => hrTables.has(r.source_table_id)).map((r) => r.name).sort()).toEqual(["FK_employees_departments", "FK_employees_manager"]);
  const imports = await createLocalDataStore(E2E_DB).model.listImports(RETAIL, hr.id);
  expect(imports).toHaveLength(1);
  expect(imports[0]).toMatchObject({ channel: "file", source_label: "hr_snapshot_2026-10-20.csv", tables_new: 2, columns_new: 10, relationships_new: 2 });
  const events = (await createLocalDataStore(E2E_DB).changeEvents.list(RETAIL)).filter((e) => e.object_type === "source_import");
  const group = (await createLocalDataStore(E2E_DB).changeEvents.list(RETAIL)).filter((e) => e.change_group_id === events[0]!.change_group_id);
  // system, tables, columns, relationships, their columns, the import; slice 7c: the file's classifications (emp_no and
  // dept_code Business key, first_name and last_name Personal data)
  expect(group).toHaveLength(1 + 2 + 10 + 2 + 2 + 1 + 4);
});

test("S7A-12 (route): a reader is refused by the server, and nothing is written", async ({ page }) => {
  await signInAs(page, "Kasia Zielińska");
  const { body } = await post(page, await inputFor(sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }, "hr.csv"));
  expect(body).toMatchObject({ ok: false, code: "forbidden" });
  expect((await loadModel()).sourceSystems.some((s) => s.name === "HR")).toBe(false);
});

test("S7A-12 (route): a reviewer, and the owner of an archived workspace, are refused by the server; nothing is written", async ({ page }) => {
  await signInAs(page, "Piotr Wiśniewski");
  const asReviewer = await post(page, await inputFor(sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }, "hr.csv"));
  expect(asReviewer.body).toMatchObject({ ok: false, code: "forbidden" });
  await archive();
  await signInAs(page, "Łukasz");
  const archived = await post(page, await inputFor(sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }, "hr.csv"));
  expect(archived.body).toMatchObject({ ok: false });
  expect((await loadModel()).sourceSystems.some((s) => s.name === "HR")).toBe(false);
});

test("P8 (route): a review that no longer matches the system writes nothing and says so", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const crm = (await loadModel()).sourceSystems.find((s) => s.name === "CRM")!;
  const input = { ...(await inputFor(sample("crm_snapshot_2026-10-20.csv"), { systemId: crm.id }, "crm.csv")), fingerprint: "stale" };
  const { body } = await post(page, input);
  expect(body).toEqual({
    ok: false,
    code: "conflict",
    message: "CRM changed since you opened this review. The review now shows the current state; check it and import again.",
    fields: { review: "stale" },
  });
  expect(await createLocalDataStore(E2E_DB).model.listImports(RETAIL)).toEqual([]);
});

test("the upload: a body above the proxy's default 10 MB arrives whole; above 25 MB it is refused", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, "Łukasz");
  // about 12 MB of rows: more than one import takes, so the server answers with the row limit, having read it all
  const rows = Array.from({ length: 150_000 }, (_, i) => `synth,s,t${Math.floor(i / 10)},column_with_a_rather_long_name_to_pass_ten_megabytes_${i},varchar(50)`);
  const text = `database,schema,table,column,data_type\n${rows.join("\n")}`;
  expect(Buffer.byteLength(text)).toBeGreaterThan(10 * 1024 * 1024);
  const { body } = await post(page, { target: { newName: "Big" }, channel: "file", sourceLabel: "big.csv", text, scope: ["x"], compare: "schemas", renames: [], fingerprint: "x" });
  expect(body).toMatchObject({ ok: false, message: "The file has 150,000 rows; one import takes up to 30,000. Split it by database or schema." });
  const huge = await page.request.post(`/w/${RETAIL}/import`, { data: { text: "x".repeat(26 * 1024 * 1024) } });
  expect(huge.status()).toBe(413);
});
