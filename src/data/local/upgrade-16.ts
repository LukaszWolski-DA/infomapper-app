// The local data file's format 16 (slice 24, D-79; acceptance F18, F19): every workspace gets its five built-in
// stereotypes. Nothing stored a stereotype's name before, and the app showed the English ones, so existing workspaces keep
// the English names (decision 7) and get the definitions in their documentation language. An entity's code outside the
// five (the CHECK made that impossible; none on KB) becomes an own stereotype named by its code, without a definition,
// so no entity is left without one; the caller logs one line for them. No change events, as earlier upgrades.

import type { Uuid } from "@/domain/ids";
import { builtinStereotypeRows, isBuiltinStereotypeCode, stereotypeRow } from "@/domain/model/stereotypes";
import type { Entity, Stereotype, Workspace } from "@/domain/types";

export interface Upgrade16Rows {
  workspace: readonly Workspace[];
  entity: readonly Entity[];
  stereotype?: Stereotype[];
}

/** Writes the rows into `db.stereotype`; returns how many own ones the entities' other codes needed. */
export function upgradeTo16(db: Upgrade16Rows, now: string, newId: () => Uuid): number {
  const rows: Stereotype[] = db.stereotype ?? [];
  const has = new Set(rows.map((s) => `${s.workspace_id}|${s.code}`));
  for (const w of db.workspace) {
    const ctx = { actorId: w.created_by, now, newId };
    for (const row of builtinStereotypeRows(ctx, w.id, w.doc_language, "en")) {
      if (has.has(`${w.id}|${row.code}`)) continue;
      rows.push(row);
      has.add(`${w.id}|${row.code}`);
    }
  }
  const creatorOf = new Map(db.workspace.map((w) => [w.id, w.created_by]));
  let own = 0;
  for (const e of db.entity) {
    const key = `${e.workspace_id}|${e.stereotype}`;
    if (isBuiltinStereotypeCode(e.stereotype) || has.has(key)) continue;
    rows.push(
      stereotypeRow(
        { id: newId(), workspace_id: e.workspace_id, created_at: now, created_by: creatorOf.get(e.workspace_id) ?? e.created_by },
        { code: e.stereotype, name: e.stereotype, definition: null, origin: "own" },
      ),
    );
    has.add(key);
    own++;
  }
  (db as { stereotype: Stereotype[] }).stereotype = rows;
  return own;
}
