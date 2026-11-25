// Baselines through the composition root (slice 35, D-87): which module tables a baseline holds is the registry's
// (`BASELINE_MODULE_TABLES`), so taking one, comparing with Now and the demo's baseline read the workspace through one
// rule (`baselineContentOf` over a `WorkspaceSnapshot`, step 1's F19). InfoMapper's layers never name a module table.

import type { DataStore } from "@/data/ports";
import { readRows, type DevDb } from "@/data/local/schema";
import { baselineContentOf, type BaselineContent } from "@/domain/baseline/content";
import { compareBaselines, olderFirst, type BaselineChange } from "@/domain/baseline/compare";
import type { Uuid } from "@/domain/ids";
import { workspaceSnapshotOf } from "@/domain/model/workspace-model";
import type { Baseline, ModuleTable, WritableRows } from "@/domain/types";
import { BASELINE_MODULE_TABLES, STORE_SCHEMA } from "./tables";

/** The workspace's state now, as a baseline would hold it (one read: `store.snapshot`); null when the workspace is gone. */
export async function baselineContentNow(store: DataStore, workspaceId: Uuid): Promise<BaselineContent | null> {
  const snapshot = await store.snapshot(workspaceId, BASELINE_MODULE_TABLES);
  return snapshot ? baselineContentOf(snapshot, BASELINE_MODULE_TABLES) : null;
}

/** The same from a data file's rows (the demo's seed, tests): the rows as the local store reads them. */
export function baselineContentOfRows(db: DevDb, workspaceId: Uuid): BaselineContent | null {
  const modules = Object.fromEntries(BASELINE_MODULE_TABLES.map((t) => [t, readRows(db, t, STORE_SCHEMA)])) as unknown as { [K in ModuleTable]: WritableRows[K][] };
  const snapshot = workspaceSnapshotOf(db, workspaceId, modules);
  return snapshot ? baselineContentOf(snapshot, BASELINE_MODULE_TABLES) : null;
}

export type CompareOutcome =
  | { ok: true; older: Baseline | null; newer: Baseline | null; changes: BaselineChange[] }
  | { ok: false; gone: true };

/**
 * A baseline compared with Now (`otherId` null) or with another baseline (B1.6, B4.6): the older state is always the
 * starting point, Now always the newer. `gone` when either baseline is no longer live (F17).
 */
export async function compareWith(store: DataStore, workspaceId: Uuid, baselineId: Uuid, otherId: Uuid | null): Promise<CompareOutcome> {
  const first = await store.baselines.get(workspaceId, baselineId);
  const second = otherId === null ? null : await store.baselines.get(workspaceId, otherId);
  if (!first || (otherId !== null && !second)) return { ok: false, gone: true };
  const [older, newer] = olderFirst(first, second);
  const contentOf = (b: Baseline | null) => (b ? store.baselines.content(workspaceId, b.id) : baselineContentNow(store, workspaceId));
  const [a, b] = await Promise.all([contentOf(older), contentOf(newer)]);
  if (!a || !b) return { ok: false, gone: true };
  return { ok: true, older, newer, changes: compareBaselines(a, b) };
}
