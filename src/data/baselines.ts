// A stored baseline's content as the store hands it on (slice 35, step 1's Q3): both adapters read it through this one
// rule. First the domain's chain (`upgradeBaselineContent`: InfoMapper's tables, from the schema it was taken at to the
// current one), then each module table's own row rules, the same as on a live read (`upgradeRows`, `readRows`: its
// upgrade, then its defaults). Pure; nothing is written back.

import type { BaselineContent } from "@/domain/baseline/content";
import { upgradeBaselineContent } from "@/domain/baseline/upgrade";
import { readRows, upgradeRows, type AnyRow, type StoreSchema } from "./rows";

export function shapedBaselineContent(stored: unknown, schemaNumber: number, schema: StoreSchema): BaselineContent {
  const content = upgradeBaselineContent(stored as BaselineContent, schemaNumber);
  const modules: Record<string, readonly AnyRow[]> = {};
  for (const [table, rows] of Object.entries(content.modules ?? {})) {
    // a module this server does not know keeps its rows as stored (nothing reads them)
    modules[table] = schema.rules[table] ? readRows(upgradeRows({ [table]: rows }, schema), table, schema) : rows;
  }
  return { ...content, modules };
}
