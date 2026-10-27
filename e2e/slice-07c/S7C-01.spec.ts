// S7C-01: the built-in list. A new workspace holds the 19 classifications of PRD item 1 from its creation, with their
// codes, scopes and groups; Effective date is general and the code PII is named "Personal data" (answer F14). Every
// upgraded workspace holds them too (S7C-02 and the unit test `upgrade-8.test.ts`).

import fs from "node:fs";
import { E2E_DB } from "../config";
import { createFromSwitcher } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { expectToast, loadModel, RETAIL, signInAs, store } from "./helpers";

const LIST = [
  ["BK", "Business key", "column", "builtin"],
  ["PII", "Personal data", "column", "builtin"],
  ["TECH", "Technical / audit", "column", "builtin"],
  ["LDTS", "Load date", "column", "builtin"],
  ["RSRC", "Record source", "column", "builtin"],
  ["EFF", "Effective date", "column", "builtin"],
  ["LK", "Link key", "column", "data_vault"],
  ["DCK", "Dependent child key", "column", "data_vault"],
  ["DK", "Driving key", "column", "data_vault"],
  ["MAK", "Multi-active key", "column", "data_vault"],
  ["T_MASTER", "Master data", "table", "builtin"],
  ["T_TXN", "Transactions", "table", "builtin"],
  ["T_REF", "Reference / code list", "table", "builtin"],
  ["T_STG", "Staging", "table", "builtin"],
  ["T_LOG", "Log / audit", "table", "builtin"],
  ["T_HIST", "History (SCD2)", "table", "builtin"],
  ["T_HUB", "Hub candidate", "table", "data_vault"],
  ["T_LNK", "Link candidate", "table", "data_vault"],
  ["T_SAT", "Satellite source", "table", "data_vault"],
].map(([code, name, scope, origin]) => ({ code, name, scope, origin }));

const listOf = (rows: { code: string | null; name: string; scope: string; origin: string; deleted_at: string | null }[]) =>
  rows
    .filter((c) => c.deleted_at === null)
    .map(({ code, name, scope, origin }) => ({ code, name, scope, origin }))
    .sort((a, b) => LIST.findIndex((x) => x.code === a.code) - LIST.findIndex((x) => x.code === b.code));

test("S7C-01: a new workspace holds the 19 built-in classifications, written in its creation's change group", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await createFromSwitcher(page, "switcher-workspace", "input-new-workspace", "Classified");
  await expectToast(page, "Created the workspace Classified.");
  await expect(page.getByTestId("switcher-workspace")).toHaveText("Classified");
  const workspaceId = /\/w\/([^/?]+)/.exec(page.url())![1]!;

  const model = await store().model.load(workspaceId);
  expect(listOf(model.classifications)).toEqual(LIST);
  // in the same change group as the workspace itself
  type Event = { workspace_id: string; object_type: string; operation: string; change_group_id: string };
  const events = (JSON.parse(fs.readFileSync(E2E_DB, "utf8")) as { change_event: Event[] }).change_event.filter((e) => e.workspace_id === workspaceId);
  const created = events.find((e) => e.object_type === "workspace" && e.operation === "create")!;
  const rows = events.filter((e) => e.object_type === "classification");
  expect(rows).toHaveLength(19);
  expect(rows.every((e) => e.change_group_id === created.change_group_id && e.operation === "create")).toBe(true);
});

test("S7C-01: the demo workspaces hold the same 19", async () => {
  expect(listOf((await loadModel()).classifications)).toEqual(LIST);
  expect((await store().model.load(RETAIL)).classifications.filter((c) => c.code === "EFF")).toMatchObject([{ origin: "builtin" }]);
});
