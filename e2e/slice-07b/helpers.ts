// Slice 7b's e2e helpers: imports written through the domain as the upload route writes them (`importAs`, the
// definition of done's two CRM files in `crmChanges`), the changes to resolve read back from the e2e data file, and the
// system and table panels' change cards on the page.

import { expect, type Page } from "@playwright/test";
import { importSources, importStateOf } from "../../src/domain/commands/import";
import { planFingerprint } from "../../src/domain/import/compare";
import { buildPlan } from "../../src/domain/import/plan";
import { readStandard } from "../../src/domain/import/standard";
import { uuidv7 } from "../../src/domain/ids";
import type { SourceChange, SourceChangeKind } from "../../src/domain/types";
import { canvasUrl, crmPartial, expectToast, loadModel, openCanvas, RETAIL, sample, SEED_IDS, signInAs, store } from "../slice-07a/helpers";

export { asPerson, setFourEyes } from "../slice-04a/helpers";
export { undo } from "../slice-03a/helpers";
export { mappingLine, row, treeItem } from "../slice-01a/helpers";
export { filterCount, imports, importNow, openWizard, reviewFile, systemNamed } from "../slice-07a/helpers";

/** Today as the changes write their dates (ISO, UTC). */
export const today = () => new Date().toISOString().slice(0, 10);
export { canvasUrl, crmPartial, expectToast, loadModel, openCanvas, RETAIL, sample, SEED_IDS, signInAs, store };

/**
 * Imports a file in the standard into an existing system as `actorId`, every table in scope, as the upload route does
 * (the plan, its fingerprint, the command); the undo history is not touched (it lives in the server's memory).
 */
export async function importAs(actorId: string, system: string, label: string, text: string): Promise<string> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const [model, changes] = await Promise.all([s.model.load(RETAIL), s.model.listChanges(RETAIL)]);
  const state = importStateOf(model, changes);
  const systemId = model.sourceSystems.find((x) => x.name === system)!.id;
  const read = readStandard(text, label);
  const scope = read.tables.map((t) => t.key);
  const plan = buildPlan(state.model, read, { systemId }, { scope: new Set(scope), compare: "schemas", renames: new Map() });
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, actorId) };
  const ctx = { actorId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = importSources(ctx, access, state, { target: { systemId }, channel: "file", sourceLabel: label, text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value.importId;
}

/**
 * The definition of done's changes (slice 7b): CRM without `customers.segment` and `customer_addresses`, then the
 * changed CRM file. Open afterwards: `segment` left; 2 new tables, 3 new columns, `created_ts` left, and two approved
 * mappings sent back (`cust_no` business key changed, fits again; `email_addr` type conflict, does not fit).
 */
export async function crmChanges(actorId: string = SEED_IDS.userLukasz): Promise<{ first: string; second: string }> {
  const first = await importAs(actorId, "CRM", "crm_partial.tsv", crmPartial());
  const second = await importAs(actorId, "CRM", "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  return { first, second };
}

/** The workspace's changes to resolve in the e2e data file. */
export const loadChanges = async (): Promise<SourceChange[]> => (await store().model.listChanges(RETAIL)).filter((c) => c.deleted_at === null);
export const openChanges = async () => (await loadChanges()).filter((c) => c.status === "open");
/** A change by its kind and the end of its label (`customers.segment`). */
export async function changeOf(kind: SourceChangeKind, label: string): Promise<SourceChange> {
  const c = (await loadChanges()).find((x) => x.kind === kind && x.object_label.endsWith(label));
  if (!c) throw new Error(`no ${kind} change on ${label}`);
  return c;
}

export async function column(table: string, name: string) {
  const m = await loadModel();
  const t = m.sourceTables.find((x) => x.name === table)!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === name)!;
}
export async function table(name: string) {
  return (await loadModel()).sourceTables.find((x) => x.name === name)!;
}

/** Signs in, opens “Customer & orders” and CRM's panel from the Sources tab. */
export async function openSystem(page: Page, user: Parameters<typeof signInAs>[1] = "Łukasz", system = "CRM") {
  await signInAs(page, user);
  await openCanvas(page, canvasUrl());
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-system").filter({ hasText: system }).getByTestId("button-open-system").click();
  await expect(page.getByTestId("panel-source-system")).toBeVisible();
}

/** A change's card on the open panel, by its kind and label. */
export const card = (page: Page, kind: SourceChangeKind, label: string) =>
  page.getByTestId("change-card").filter({ has: page.getByTestId("change-label").filter({ hasText: label }) }).and(page.locator(`[data-kind="${kind}"]`));

/** Clicks an action on a card and waits for its toast (“{resolution}: {label}”). */
export async function act(page: Page, kind: SourceChangeKind, label: string, action: string, toast: string | RegExp) {
  await card(page, kind, label).getByTestId(`change-action-${action}`).click();
  await expectToast(page, toast);
}
