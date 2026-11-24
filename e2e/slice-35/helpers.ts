// Slice 35's helpers: the Baselines tab, its rows and dialogs, and the e2e data file's baselines and change events.
import { expect, type Locator, type Page } from "@playwright/test";
import { STORE_SCHEMA } from "../../src/compose/tables";
import { DEMO_BASELINE } from "../../src/compose/seed";
import { readDb } from "../../src/data/local/file";
import { SEED_IDS } from "../../src/data/local/seed";
import { createLocalDataStore } from "../../src/data/local/store";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { E2E_DB } from "../config";

export { expectToast, signInAs } from "../slice-00/helpers";
export { archive } from "../slice-07a/helpers";
export { DEMO_BASELINE, SEED_IDS };

export const RETAIL = SEED_IDS.wsRetailDwh;
export const baselinesUrl = (ws: string = RETAIL) => `/w/${ws}?tab=baselines`;
/** The composed store over the e2e data file (InfoCube's tables too). */
export const composedStore = () => createLocalDataStore(E2E_DB, STORE_SCHEMA);

export async function openBaselines(page: Page): Promise<void> {
  await page.goto(baselinesUrl());
  await expect(page.getByTestId("tab-baselines")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tab-body-baselines")).toBeVisible();
}

export const rows = (page: Page): Locator => page.getByTestId("baseline-row");
export const rowNamed = (page: Page, name: string): Locator => rows(page).filter({ has: page.getByTestId("baseline-name").getByText(name, { exact: true }) });
export const tabLabel = (page: Page): Locator => page.getByTestId("tab-baselines");

/** Takes a baseline through the box. */
export async function createInBox(page: Page, name: string, note = ""): Promise<void> {
  await page.getByTestId("input-baseline-name").fill(name);
  await page.getByTestId("input-baseline-note").fill(note);
  await page.getByTestId("button-create-baseline").click();
}

export const renameDialog = (page: Page) => page.getByTestId("dialog-rename-baseline");
export const deleteDialog = (page: Page) => page.getByTestId("dialog-delete-baseline");
export const compareDialog = (page: Page) => page.getByTestId("dialog-compare-baseline");

/** Opens Compare… on a row and waits for its first answer. */
export async function openCompare(page: Page, name: string): Promise<Locator> {
  await rowNamed(page, name).getByTestId("button-baseline-compare").click();
  const dialog = compareDialog(page);
  await expect(dialog.getByTestId("text-compare-line")).toBeVisible();
  return dialog;
}

/** The comparison's rows as "Kind | Item | What changed". */
export const compareRows = async (dialog: Locator): Promise<string[]> =>
  dialog.getByTestId("compare-row").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()).join(" | ")));

/** The e2e data file's baselines, deleted ones too (rows only). */
export const storedBaselines = async () => (await readDb(E2E_DB)).baseline;
export const storedBaseline = async (name: string) => (await storedBaselines()).find((b) => b.name === name && b.deleted_at === null);
export const baselineEvents = async () => (await readDb(E2E_DB)).change_event.filter((e) => e.object_type === "baseline");

/** A domain command as a person, through the composed store (test data). */
export async function asPersonHere<T>(userId: string, command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>): Promise<T> {
  const s = composedStore();
  const access = { workspace: (await s.workspaces.get(RETAIL))!, member: await s.workspaces.getMember(RETAIL, userId) };
  const result = command({ actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() }, access);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** "yyyy-mm-dd hh:mm" of a time in the test's time zone (the browser's: the e2e run is in Europe/Warsaw). */
export const minute = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
