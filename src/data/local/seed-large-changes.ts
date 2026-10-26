// `npm run seed:large -- --changes` (slice 7b, step 5; step 1, question 17): a recorded import into each system of
// “Performance test”, written through the domain as the upload route writes it, so the Changes view fades a realistic
// canvas for section 6's figure. About 10 % of the tables change: every tenth table loses its last column and gains a
// new one (column left, new column; high where the column was mapped and approved), and every thirtieth table is left
// out of the file (table left). Only on request: without it “Performance test” stays as slice 7a's element guard
// counted it.

import { importSources, importStateOf } from "@/domain/commands/import";
import { planFingerprint } from "@/domain/import/compare";
import { toCsv } from "@/domain/import/delimited";
import { buildPlan } from "@/domain/import/plan";
import { readStandard } from "@/domain/import/standard";
import { uuidv7 } from "@/domain/ids";
import { formatColumnType } from "@/domain/model/type-check";
import { SEED_IDS } from "./seed";
import { LARGE_IDS } from "./seed-large";
import { createLocalDataStore } from "./store";

const HEAD = ["database", "schema", "table", "column", "ordinal", "data_type", "nullable", "primary_key"];
export const LARGE_CHANGES_LABEL = "perf_changes.csv";

/** Adds the import with changes; false when “Performance test” has an import already. */
export async function addLargeChanges(file: string): Promise<boolean> {
  const store = createLocalDataStore(file);
  const ws = LARGE_IDS.workspace, by = SEED_IDS.userLukasz;
  if ((await store.model.listImports(ws)).length) return false;
  const first = await store.model.load(ws);
  for (const system of first.sourceSystems) {
    const [model, changes, workspace, member] = await Promise.all([store.model.load(ws), store.model.listChanges(ws), store.workspaces.get(ws), store.workspaces.getMember(ws, by)]);
    const tables = model.sourceTables.filter((t) => t.source_system_id === system.id).sort((a, b) => a.name.localeCompare(b.name));
    const rows: (string | number)[][] = [HEAD];
    tables.forEach((t, i) => {
      if (i % 30 === 7) return; // table left
      const columns = model.sourceColumns.filter((c) => c.source_table_id === t.id).sort((a, b) => a.ordinal - b.ordinal);
      const changed = i % 10 === 3;
      (changed ? columns.slice(0, -1) : columns).forEach((c) =>
        rows.push([t.database_name, t.schema_name, t.name, c.name, c.ordinal, formatColumnType(c), c.is_nullable ? "yes" : "no", c.is_primary_key ? "yes" : "no"]),
      );
      if (changed) rows.push([t.database_name, t.schema_name, t.name, "added_col", columns.length + 1, "varchar(20)", "yes", "no"]);
    });
    const text = toCsv(rows);
    const read = readStandard(text, LARGE_CHANGES_LABEL, { maxRows: Infinity });
    const scope = read.tables.map((t) => t.key);
    const state = importStateOf(model, changes);
    const target = { systemId: system.id };
    const plan = buildPlan(state.model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
    const ctx = { actorId: by, now: new Date().toISOString(), newId: () => uuidv7() };
    const result = importSources(ctx, { workspace: workspace!, member }, state, {
      target,
      channel: "file",
      sourceLabel: LARGE_CHANGES_LABEL,
      text,
      scope,
      compare: "schemas",
      renames: [],
      fingerprint: planFingerprint(plan),
    });
    if (!result.ok) throw new Error(result.error.message);
    const applied = await store.apply(result.writeSet);
    if (!applied.ok) throw new Error(applied.error.message);
  }
  return true;
}
