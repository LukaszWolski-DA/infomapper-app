// What the canvas draws, as plain serialisable data: built on the server from the model and the canvas's cards,
// passed to the client canvas. Pure TypeScript, so it is tested without a browser.

import type { Uuid } from "@/domain/ids";
import { checkMappingTypes, formatAttributeType, formatColumnType } from "@/domain/model/type-check";
import type { CanvasItem, RowFilter, WorkspaceModel } from "@/domain/types";

export type CardKind = "ent" | "src";

export interface CardRow {
  /** Attribute or source column id. */
  id: Uuid;
  name: string;
  /** Shown type: `Integer`, `String(100)` for attributes; `varchar(20)` for columns. */
  type: string;
  pk: boolean;
  fk: boolean;
  /** PII badge (attributes). */
  pii: boolean;
  /** BK badge: a business-key attribute (AD-28) or a column marked BK. */
  bk: boolean;
  /** Number of live mappings reading or filling this row. */
  mappings: number;
  /** One of them has a type problem (D-01). */
  warn: boolean;
  /** Tooltip of the mapped dot: where it comes from or goes to. */
  title: string;
}

export interface CardData {
  /** The canvas_item id; also the React Flow node id. */
  id: Uuid;
  version: number;
  kind: CardKind;
  /** The entity or source table. */
  targetId: Uuid;
  name: string;
  /** Entity: stereotype (`Object`); source: path (`CRM / crmprod.dbo`). */
  line1: string;
  /** Entity: `in Customer`; source: empty. */
  line1b: string;
  /** Entity: concept colour; source: null (physical colour). */
  color: string | null;
  rows: CardRow[];
  /** Rows with at least one mapping, for the coverage bar. */
  mapped: number;
  x: number;
  y: number;
  /** null = default width (D-37). */
  width: number | null;
  collapsed: boolean;
  rowFilter: Exclude<RowFilter, "labeled">;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The cards of one canvas, in drawing order (sources first, as in the prototype). */
export function buildCards(model: WorkspaceModel, items: readonly CanvasItem[]): CardData[] {
  const attributeById = new Map(model.attributes.map((a) => [a.id, a]));
  const columnById = new Map(model.sourceColumns.map((c) => [c.id, c]));
  const entityById = new Map(model.entities.map((e) => [e.id, e]));
  const conceptById = new Map(model.concepts.map((c) => [c.id, c]));
  const tableById = new Map(model.sourceTables.map((t) => [t.id, t]));
  const systemById = new Map(model.sourceSystems.map((s) => [s.id, s]));
  const columnTable = (columnId: Uuid) => tableById.get(columnById.get(columnId)?.source_table_id ?? "");

  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of model.mappingInputs) inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.source_column_id]);

  // Per row: how many mappings, any with a type problem, and the tooltip lines.
  const info = new Map<Uuid, { n: number; warn: boolean; lines: string[] }>();
  const note = (rowId: Uuid, warn: boolean, line: string) => {
    const r = info.get(rowId) ?? { n: 0, warn: false, lines: [] };
    r.n++;
    r.warn ||= warn;
    r.lines.push(line);
    info.set(rowId, r);
  };
  for (const m of model.mappings) {
    const attribute = attributeById.get(m.attribute_id);
    if (!attribute) continue;
    const columns = (inputsOf.get(m.id) ?? []).map((id) => columnById.get(id)).filter((c) => c !== undefined);
    const warn = !checkMappingTypes(m, attribute, columns).ok;
    const attrLabel = `${entityById.get(attribute.entity_id)?.name ?? "?"}.${attribute.name}`;
    note(attribute.id, warn, `from ${columns.map((c) => `${columnTable(c.id)?.name ?? "?"}.${c.name}`).join(" + ")}`);
    for (const c of columns) note(c.id, warn, `to ${attrLabel}`);
  }
  const rowState = (id: Uuid, empty: string) => {
    const r = info.get(id);
    return { mappings: r?.n ?? 0, warn: r?.warn ?? false, title: r ? r.lines.join("\n") : empty };
  };

  const cards: CardData[] = [];
  for (const item of items) {
    const base = {
      id: item.id,
      version: item.version,
      x: item.x,
      y: item.y,
      width: item.width,
      collapsed: item.collapsed,
      rowFilter: item.row_filter === "labeled" ? "all" : item.row_filter,
    } as const;
    if (item.entity_id) {
      const entity = entityById.get(item.entity_id);
      if (!entity) continue;
      const concept = conceptById.get(entity.concept_id);
      const rows: CardRow[] = model.attributes
        .filter((a) => a.entity_id === entity.id)
        .map((a) => ({
          id: a.id,
          name: a.name,
          type: cap(formatAttributeType(a)),
          pk: a.is_primary_key,
          fk: a.is_foreign_key,
          pii: a.is_pii,
          bk: a.is_business_key,
          ...rowState(a.id, "Not mapped yet"),
        }));
      cards.push({
        ...base,
        kind: "ent",
        targetId: entity.id,
        name: entity.name,
        line1: cap(entity.stereotype),
        line1b: `in ${concept?.name ?? "–"}`,
        color: concept?.color ?? null,
        rows,
        mapped: rows.filter((r) => r.mappings > 0).length,
      });
    } else if (item.source_table_id) {
      const table = tableById.get(item.source_table_id);
      if (!table) continue;
      const rows: CardRow[] = model.sourceColumns
        .filter((c) => c.source_table_id === table.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: formatColumnType(c),
          pk: c.is_primary_key,
          fk: c.is_foreign_key,
          pii: false,
          bk: c.is_business_key,
          ...rowState(c.id, "Not used yet"),
        }));
      cards.push({
        ...base,
        kind: "src",
        targetId: table.id,
        name: table.name,
        line1: `${systemById.get(table.source_system_id)?.name ?? "?"} / ${table.database_name}.${table.schema_name}`,
        line1b: "",
        color: null,
        rows,
        mapped: rows.filter((r) => r.mappings > 0).length,
      });
    }
  }
  return cards.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "src" ? -1 : 1));
}

/** The rows a card shows under its filter (prototype rowsOf); a collapsed card shows none. */
export function visibleRows(card: Pick<CardData, "rows" | "collapsed" | "rowFilter">): CardRow[] {
  if (card.collapsed) return [];
  switch (card.rowFilter) {
    case "mapped":
      return card.rows.filter((r) => r.mappings > 0);
    case "unmapped":
      return card.rows.filter((r) => r.mappings === 0);
    case "keys":
      return card.rows.filter((r) => r.pk || r.fk || r.bk);
    default:
      return card.rows;
  }
}
