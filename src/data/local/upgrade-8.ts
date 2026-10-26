// The local data file's upgrade from format 7 to 8 (slice 7c, PRD item 5, step 1 Q3/Q4, answers F5, Q4). Like slice
// 7b's derivation it is no undo step and changes no model content: it writes what the data said in the new form.
//   - every workspace gets the 19 built-in classifications (item 4), unless it has them already;
//   - every source column's `is_business_key` becomes a Business key link and `is_pii` a Personal data link, and the
//     two fields are dropped (P3);
//   - every live column's comment that no import wrote moves into the column's note when the note is empty, and the
//     comment is cleared (P9). The change log tells: a comment came from an import when a change group with a
//     `source_import` event wrote this exact value onto this column; otherwise it was typed by hand (Q4). That holds
//     after undo and redo, which put back values an import wrote earlier;
//   - one change group per workspace, its events signed by the workspace's creator: a create per classification and
//     link, an update per moved comment. The report names each moved comment's column, never its text (CLAUDE.md:
//     no rich-text content in logs).
//   - tables and columns get `note_html` and `note_text` (null) where they have none.

import { plainTextPair } from "@/domain/model/plain-text";
import { BUILTIN_CLASSIFICATIONS, normClassification } from "@/domain/model/classifications";
import type { ChangeEvent, Classification, ClassificationLink, SourceColumn } from "@/domain/types";
import type { DevDb } from "./schema";

/** A column whose hand-typed comment moved into its note: `{system} / {database}.{schema}.{table}.{column}`. */
export interface MovedComment {
  workspace: string;
  column: string;
}

export interface Upgrade8Report {
  classifications: number;
  links: number;
  moved: MovedComment[];
}

type OldColumn = SourceColumn & { is_business_key?: boolean; is_pii?: boolean };

export function upgradeTo8(db: DevDb, now: string, newId: () => string): Upgrade8Report {
  db.classification ??= [];
  db.classification_link ??= [];
  for (const t of db.source_table) Object.assign(t, { note_html: t.note_html ?? null, note_text: t.note_text ?? null });
  for (const c of db.source_column) Object.assign(c, { note_html: c.note_html ?? null, note_text: c.note_text ?? null });

  // the values imports wrote, per column
  const importGroups = new Set(db.change_event.filter((e) => e.object_type === "source_import").map((e) => e.change_group_id));
  const imported = new Set<string>();
  for (const e of db.change_event) {
    if (e.object_type !== "source_column" || !importGroups.has(e.change_group_id)) continue;
    const comment = e.after_image?.comment;
    if (typeof comment === "string") imported.add(`${e.object_id}|${comment}`);
  }

  const report: Upgrade8Report = { classifications: 0, links: 0, moved: [] };
  const tableById = new Map(db.source_table.map((t) => [t.id, t]));
  const systemById = new Map(db.source_system.map((s) => [s.id, s]));
  for (const ws of db.workspace) {
    const events: ChangeEvent[] = [];
    const group = newId();
    const event = (object_type: string, object_id: string, before: object | null, after: object): ChangeEvent => ({
      id: newId(),
      workspace_id: ws.id,
      change_group_id: group,
      occurred_at: now,
      user_id: ws.created_by,
      object_type,
      object_id,
      operation: before ? "update" : "create",
      before_image: before ? (structuredClone(before) as ChangeEvent["before_image"]) : null,
      after_image: structuredClone(after) as ChangeEvent["after_image"],
      context_label_id: null,
    });
    const audit = { workspace_id: ws.id, version: 1, created_at: now, created_by: ws.created_by, updated_at: now, updated_by: ws.created_by, deleted_at: null };

    const byCode = new Map(db.classification.filter((c) => c.workspace_id === ws.id && c.code !== null).map((c) => [c.code!, c]));
    for (const b of BUILTIN_CLASSIFICATIONS) {
      if (byCode.has(b.code)) continue;
      const row: Classification = { id: newId(), ...audit, code: b.code, name: b.name, name_key: normClassification(b.name), scope: b.scope, origin: b.origin };
      db.classification.push(row);
      byCode.set(b.code, row);
      events.push(event("classification", row.id, null, row));
      report.classifications++;
    }

    for (const c of db.source_column as OldColumn[]) {
      if (c.workspace_id !== ws.id) continue;
      const flags = { BK: c.is_business_key === true, PII: c.is_pii === true };
      delete c.is_business_key;
      delete c.is_pii;
      for (const code of ["BK", "PII"] as const) {
        if (!flags[code] || c.deleted_at !== null) continue;
        const link: ClassificationLink = { id: newId(), ...audit, classification_id: byCode.get(code)!.id, source_table_id: null, source_column_id: c.id };
        db.classification_link.push(link);
        events.push(event("classification_link", link.id, null, link));
        report.links++;
      }
      if (c.deleted_at !== null || !c.comment || c.note_text || imported.has(`${c.id}|${c.comment}`)) continue;
      const before = { ...c };
      const { html, text } = plainTextPair(c.comment);
      Object.assign(c, { note_html: html, note_text: text, comment: null, version: c.version + 1, updated_at: now, updated_by: ws.created_by });
      events.push(event("source_column", c.id, before, c));
      const t = tableById.get(c.source_table_id);
      report.moved.push({ workspace: ws.name, column: `${systemById.get(t?.source_system_id ?? "")?.name ?? "?"} / ${t?.database_name}.${t?.schema_name}.${t?.name}.${c.name}` });
    }
    db.change_event.push(...events);
  }
  return report;
}

/** The report file's text (Q4): the columns only, never the comments' text. */
export function upgradeReportText(report: Upgrade8Report, at: string): string {
  const lines = [
    `Slice 7c upgrade of the local data file to format 8, ${at}.`,
    `${report.classifications} built-in classifications written, ${report.links} Business key and Personal data flags turned into classifications.`,
    report.moved.length ? `${report.moved.length} hand-typed column comments moved into the column's note (the comment is now the source's only):` : "No hand-typed column comment to move.",
    ...report.moved.map((m) => `- ${m.workspace}: ${m.column}`),
  ];
  return `${lines.join("\n")}\n`;
}
