// npm run seed:large: adds the workspace “Performance test” for Łukasz with the canvas spike's data set
// (100 cards: 60 source tables and 40 entities, one more entity with 200 attributes, 300 mappings, 40 relationships),
// all on one canvas at the spike's positions, with its 8 frames as free frames (slice 2b). For the performance checks.

import type { Uuid } from "@/domain/ids";
import { CONCEPT_PALETTE } from "@/domain/model/concept-colors";
import { parseColumnLines } from "@/domain/model/column-lines";
import { DEFAULT_CANVAS_LOOK, type LogicalType, type MappingStatus, type Stereotype } from "@/domain/types";
import { ATTR_TYPES, ENT_COLORS, FRAME_NAMES, generate, STEREOS } from "./large-generator";
import { findViolation, type DevDb } from "./schema";
import { SEED_IDS } from "./seed";
import { seedId } from "./seed-model";

export const LARGE_IDS = {
  workspace: "01a0f9e9-2012-7a40-9c1d-5e1f0a7e5701",
  project: "01a0f9e9-2013-7b20-8e44-0c3b9f1d2a02",
  canvas: "01a0f9e9-2014-7c80-a0f5-6d2e8b4c1f03",
} as const;

const LOGICAL: Record<(typeof ATTR_TYPES)[number], LogicalType> = {
  String: "string",
  Integer: "integer",
  Date: "date",
  Timestamp: "datetime",
  Decimal: "decimal",
  Boolean: "boolean",
  Code: "string",
};

const STEREOTYPE: Record<(typeof STEREOS)[number], Stereotype> = {
  Hub: "object",
  Satellite: "context",
  Link: "link",
  Reference: "dictionary",
  Dimension: "object",
  Fact: "object",
};

const STATUSES: MappingStatus[] = ["approved", "review", "draft"];

/** Adds the performance workspace to the file's data. Returns false when it is there already. */
export function addLargeWorkspace(db: DevDb, at: string): boolean {
  if (db.workspace.some((w) => w.id === LARGE_IDS.workspace)) return false;
  const ws = LARGE_IDS.workspace;
  const by = SEED_IDS.userLukasz;
  const audit = { version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null };
  const std = (key: string) => ({ id: seedId(ws, key), workspace_id: ws, ...audit });
  const id = (key: string) => seedId(ws, key);

  db.workspace.push({
    id: ws,
    organization_id: SEED_IDS.orgInfoMate,
    name: "Performance test",
    client_name: null,
    description: "Generated data for the canvas performance check (the canvas spike's data set).",
    doc_language: "en",
    dv2_mode: false,
    four_eyes: false,
    archived_at: null,
    archived_by: null,
    requirement_key_next: 101,
    ...audit,
  });
  db.workspace_member.push({ workspace_id: ws, user_id: by, role: "owner", added_by: by, created_at: at });
  db.project.push({ id: LARGE_IDS.project, workspace_id: ws, name: "Performance", description: null, ...audit });
  db.canvas.push({ id: LARGE_IDS.canvas, workspace_id: ws, name: "100 cards", live_label_id: null, look: { ...DEFAULT_CANVAS_LOOK }, ...audit });
  db.project_canvas.push({ project_id: LARGE_IDS.project, canvas_id: LARGE_IDS.canvas, workspace_id: ws, sort_order: 0, added_at: at, added_by: by });

  const data = generate();

  // One concept per entity colour of the generator, coloured from the concept palette.
  FRAME_NAMES.forEach((name, i) => {
    db.concept.push({ ...std(`concept:${i}`), name, description_html: null, description_text: null, color: CONCEPT_PALETTE[i]!, sort_order: i });
  });

  const systems = new Map<string, Uuid>();
  const rowIds = new Map<string, Uuid>();

  // The spike's frames, as free frames in its colours; each holds the cards the generator put in it.
  for (const f of data.frames) {
    db.frame.push({
      ...std(`frame:${f.id}`),
      canvas_id: LARGE_IDS.canvas,
      name: f.name,
      kind: "free",
      concept_id: null,
      source_system_id: null,
      color: f.color,
      x: f.x,
      y: f.y,
      width: f.w,
      height: f.h,
      collapsed: false,
    });
  }

  for (const card of data.cards) {
    if (card.kind === "src") {
      const [system, path] = card.sub.split(" / ") as [string, string];
      const [database, schema] = path.split(".") as [string, string];
      if (!systems.has(system)) {
        systems.set(system, id(`system:${system}`));
        db.source_system.push({ ...std(`system:${system}`), name: system, description: null });
      }
      const tableId = id(`table:${card.id}`);
      db.source_table.push({
        ...std(`table:${card.id}`),
        source_system_id: systems.get(system)!,
        database_name: database,
        schema_name: schema,
        name: card.name,
        object_type: "table",
        row_count: null,
        comment: null,
      });
      const parsed = parseColumnLines(card.rows.map((r) => `${r.name} ${r.dataType}`).join("\n"));
      if (!parsed.ok) throw new Error(`Generated table ${card.name}: ${parsed.error.message}`);
      parsed.columns.forEach((c, i) => {
        const row = card.rows[i]!;
        rowIds.set(row.id, id(`column:${row.id}`));
        db.source_column.push({
          ...std(`column:${row.id}`),
          source_table_id: tableId,
          ...c,
          ordinal: i + 1,
          is_nullable: !row.pk,
          is_primary_key: !!row.pk,
          is_foreign_key: !!row.fk,
          is_business_key: false,
          is_pii: false,
          default_value: null,
          comment: null,
        });
      });
    } else {
      const entityId = id(`entity:${card.id}`);
      const colour = Math.max(0, ENT_COLORS.indexOf(card.color ?? ""));
      db.entity.push({
        ...std(`entity:${card.id}`),
        concept_id: id(`concept:${colour}`),
        name: card.name,
        stereotype: STEREOTYPE[card.sub as (typeof STEREOS)[number]] ?? "object",
        definition_html: null,
        definition_text: null,
      });
      card.rows.forEach((row, i) => {
        rowIds.set(row.id, id(`attribute:${row.id}`));
        db.attribute.push({
          ...std(`attribute:${row.id}`),
          entity_id: entityId,
          name: row.name,
          sort_order: i,
          data_type: LOGICAL[row.dataType as (typeof ATTR_TYPES)[number]] ?? "string",
          custom_type: null,
          type_length: null,
          type_precision: null,
          type_scale: null,
          is_primary_key: !!row.pk,
          is_foreign_key: false,
          is_business_key: false,
          is_pii: false,
          is_nullable: !row.pk,
          definition_html: null,
          definition_text: null,
        });
      });
    }
    db.canvas_item.push({
      ...std(`card:${card.id}`),
      canvas_id: LARGE_IDS.canvas,
      entity_id: card.kind === "ent" ? id(`entity:${card.id}`) : null,
      source_table_id: card.kind === "src" ? id(`table:${card.id}`) : null,
      requirement_id: null,
      x: card.x,
      y: card.y,
      width: null,
      collapsed: false,
      row_filter: "all",
      frame_id: card.frameId ? id(`frame:${card.frameId}`) : null,
      live_level: null,
    });
  }

  data.mappings.forEach((m, i) => {
    const status = STATUSES[i % STATUSES.length]!;
    db.mapping.push({
      ...std(`mapping:${m.id}`),
      attribute_id: rowIds.get(m.attribute)!,
      kind: "direct",
      rule_expression: null,
      status,
      note_html: null,
      note_text: null,
      approved_by: status === "approved" ? by : null,
      approved_at: status === "approved" ? at : null,
    });
    db.mapping_input.push({ ...std(`mapping:${m.id}#0`), mapping_id: id(`mapping:${m.id}`), source_column_id: rowIds.get(m.column)!, sort_order: 0 });
  });

  for (const r of data.relationships) {
    db.relationship.push({
      ...std(`relationship:${r.id}`),
      from_entity_id: id(`entity:${r.from}`),
      to_entity_id: id(`entity:${r.to}`),
      label: r.label ?? null,
      from_min: r.fromMin,
      from_max: r.fromMax === "N" ? "n" : "1",
      to_min: r.toMin,
      to_max: r.toMax === "N" ? "n" : "1",
      description: null,
    });
  }

  const violation = findViolation(db);
  if (violation) throw new Error(`Generated data breaks a rule: ${violation.table}: ${violation.detail}`);
  return true;
}
