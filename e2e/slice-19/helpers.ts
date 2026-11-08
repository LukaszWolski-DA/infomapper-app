// Slice 19's helpers: the star's new dimensions and their ids, InfoCube's rows through the composed store, a domain
// command as a person through the composed store (InfoCube's tables need it), the panels' new fields, and an older local
// file's rows (slice 18's shape: `scd_type`, none of the new columns).

import type { Locator, Page } from "@playwright/test";
import { uuidv7 } from "../../src/domain/ids";
import { readDb, writeDb } from "../../src/data/local/file";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { starId } from "../../src/modules/infocube/data/sales-star";
import type { CubeEntity } from "../../src/modules/infocube/domain/types";
import { RETAIL } from "../slice-01a/helpers";
import { E2E_DB } from "../config";
import { cubeStore } from "../slice-15a/helpers";

export * from "../slice-18/helpers";
export { canvasCommits } from "../slice-03b/helpers";
export { settledCommits, clickLine } from "../slice-10a/helpers";
export { openBusMatrix } from "../slice-15d/helpers";
export { redoButton, undoButton } from "../slice-12a/helpers";

/** The star's entities, slice 19's two new dimensions included. */
export const typeEntity = (key: "sales" | "orders" | "cust" | "prod" | "date" | "cat" | "flags") => starId(RETAIL, `entity:${key}`);
/** The relationship "groups": Dim Category → Dim Product. */
export const GROUPS = starId(RETAIL, "relationship:cat>prod");

/** A fact's or a dimension's InfoCube row, by its entity id. */
export async function cubeRow(entityId: string): Promise<CubeEntity | undefined> {
  return (await cubeStore().modules.list(RETAIL, "cube_entity")).find((c) => c.entity_id === entityId && c.deleted_at === null);
}

/** Runs a domain command as a person through the composed store (InfoCube's tables), as the server would. */
export async function asCube<T>(userId: string, command: (ctx: CommandContext, access: WorkspaceAccess, s: ReturnType<typeof cubeStore>) => CommandResult<T> | Promise<CommandResult<T>>): Promise<T> {
  const s = cubeStore();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = await command(ctx, access as WorkspaceAccess, s);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** The e2e data file's `cube_entity` rows written back in slice 18's shape (F1): `scd_type`, none of the new columns. */
export async function writeOlderCubeRows(): Promise<void> {
  const db = (await readDb(E2E_DB)) as unknown as { cube_entity: Record<string, unknown>[] };
  const scd: Record<string, number> = { keep: 0, overwrite: 1, history: 2, snapshot: 1 };
  db.cube_entity = db.cube_entity.map((r) => {
    const { fact_type, is_factless, base_fact_entity_id, dim_kind, history, snapshot_period, ...rest } = r;
    void [fact_type, is_factless, base_fact_entity_id, dim_kind, snapshot_period];
    return { ...rest, scd_type: r.role === "fact" ? null : scd[history as string] };
  });
  await writeDb(E2E_DB, db as never);
}

/** The panels' new fields (slice 19). */
export const factTypeSeg = (page: Page): Locator => page.getByTestId("seg-cube-fact-type");
export const factlessFlag = (page: Page): Locator => page.getByTestId("field-cube-factless").getByRole("button", { name: "Factless fact" });
export const baseSelect = (page: Page): Locator => page.getByTestId("select-cube-base");
export const kindSeg = (page: Page): Locator => page.getByTestId("seg-cube-kind-dim");
export const historySeg = (page: Page): Locator => page.getByTestId("seg-cube-scd");
export const periodField = (page: Page): Locator => page.getByTestId("input-cube-snapshot-period");
/** A segment's button by its text. */
export const segment = (seg: Locator, text: string): Locator => seg.getByRole("button", { name: text, exact: true });
/** A Cube tab item by its entity's name. */
export const cubeItem = (page: Page, name: string): Locator => page.getByTestId("tree-item").filter({ hasText: name });
