// What the canvas draws, as plain serialisable data: built on the server from the model and the canvas's cards,
// passed to the client canvas. Pure TypeScript, so it is tested without a browser.

import type { Uuid } from "@/domain/ids";
import { rowShown } from "@/domain/model/card-size";
import { indexOf } from "@/domain/model/classifications";
import type { CardSubject } from "@/domain/model/frames";
import { checkMappingTypes, formatAttributeType, formatColumnType } from "@/domain/model/type-check";
import { cardShownNames } from "@/domain/model/aliases";
import type { Canvas, CanvasItem, LiveLevel, NameMode, RowFilter, SourceChange, WorkspaceModel } from "@/domain/types";
import { lineNeedsClip, rowNeedsClip, titleNeedsClip } from "./text-fit";

export type CardKind = "ent" | "src";

export interface CardRow {
  /** Attribute or source column id. */
  id: Uuid;
  /** The model's name: toasts and questions name the row by it (slice 11, P3). */
  name: string;
  /** The attribute's alias, only when it has one (slice 11). */
  alias?: string;
  /** What the row shows when it is not the name: the alias in alias mode (`applyNames`; slice 11, F8). */
  shown?: string;
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
  /** The name may not fit: it gets the clip and the ellipsis (text-fit.ts). */
  clip: boolean;
  /** Working labels on the attribute or column, as the tag mark's tooltip (“CR-23, JIRA-481”); null without (slice 3a). */
  labels: string | null;
  /** On a live canvas: the row carries the canvas's label, or one of its mappings does (bold, the Labeled filter; slice 3b). */
  relevant?: boolean;
  /** A column missing from source (slice 7a, item 34): struck through and muted, a class on the row. */
  missing?: true;
  /** A retired column (slice 7b, item 24): grey, “Retired: historical”; wins over `missing`. */
  retired?: true;
  /**
   * An open change to resolve on the column (slice 7b, item 24; prototype `colRow`): `new` for a new column to decide,
   * `chg` for any other open change. A class on the row; `retired` and `missing` win.
   */
  change?: "new" | "chg";
}

export interface CardData {
  /** The canvas_item id; also the React Flow node id. */
  id: Uuid;
  version: number;
  kind: CardKind;
  /** The entity or source table. */
  targetId: Uuid;
  /** The model's name: toasts and questions name the card by it (slice 11, P3). */
  name: string;
  /** The entity's alias, only when it has one (slice 11). */
  alias?: string;
  /** What the header shows when it is not the name: the alias in alias mode (`applyNames`; slice 11, F8). */
  shown?: string;
  /** The entity card's exceptions to the canvas's names or aliases, only when set (slice 11, D-64). */
  entityNames?: NameMode;
  attributeNames?: NameMode;
  /** Entity: stereotype (`Object`); source: path (`CRM / crmprod.dbo`). */
  line1: string;
  /** Entity: `in Customer`; source: empty. */
  line1b: string;
  /** Entity: concept colour; source: null (physical colour). */
  color: string | null;
  rows: CardRow[];
  /** Rows with at least one mapping, for the coverage bar. */
  mapped: number;
  /** The title or the first line may not fit: they get the clip and the ellipsis (text-fit.ts). */
  clipName: boolean;
  clipLine1: boolean;
  x: number;
  y: number;
  /** null = default width (D-37). */
  width: number | null;
  collapsed: boolean;
  /** `labeled` only on a live canvas (slice 3b); elsewhere a stored `labeled` shows as `all`. */
  rowFilter: RowFilter;
  /** On a live canvas: full when the label is on the element, context when only on its rows or mappings (slice 3b). */
  liveLevel: LiveLevel | null;
  /** A context card's tooltip (“Context: the entity itself is not labeled CR-23, …”); null otherwise. */
  liveTitle: string | null;
  /** On a live canvas: what taking the card off unlabels, for its question (PRD item 11); computed once by the page. */
  liveRemove?: LiveRemove;
  /** The frame the card belongs to on this canvas (slice 2b, D-05). */
  frameId: Uuid | null;
  /** An entity of a concept or a table of a system: what a concept or source frame checks (misplaced cards). */
  subject: CardSubject;
  /** The mappings that read or fill the card's rows, for a frame's “type” and “drafts” chips (each counted once). */
  links: { id: Uuid; warn: boolean; draft: boolean }[];
  /** Working labels on the entity or source table, for the tag mark in its header at every zoom (slice 3a); null when unlabeled. */
  labels: string | null;
  /** When the card was placed (server time; a late fresh page keeps a card placed after it read the data, `mergeFresh`). */
  createdAt: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Label names per item (`labelNamesByItem`); empty when the page has no labels to show. */
export type LabelNames = ReadonlyMap<string, readonly string[]>;
const NO_LABELS: LabelNames = new Map();

/** What taking a card off a live canvas unlabels: the element itself, or `what` (“2 attributes and 1 mapping”) of it. */
export interface LiveRemove {
  direct: boolean;
  /** Rows and mappings of it that carry the label, as words, and how many. */
  what: string;
  others: number;
}

/** What a live canvas adds to its cards (slice 3b): the rows its label makes relevant (computed once by the page). */
export interface LiveCards {
  /** Each card's remove question (by element). */
  removeOf: (target: { kind: "entity" | "source_table"; id: Uuid }) => LiveRemove;
  /** The live canvas's label, for a context card's tooltip. */
  labelName: string;
  relevantRows: ReadonlySet<Uuid>;
}

/** The cards of one canvas, in drawing order (sources first, as in the prototype). */
export function buildCards(
  model: WorkspaceModel,
  items: readonly CanvasItem[],
  labelNames: LabelNames = NO_LABELS,
  live: LiveCards | null = null,
  /** The workspace's changes to resolve (slice 7b): the open ones mark their columns. */
  changes: readonly SourceChange[] = [],
  /** The canvas's names or aliases (slice 11): what the cards show on the first paint. */
  canvas?: CanvasNames,
): CardData[] {
  const labelsOf = (key: string) => labelNames.get(key)?.join(", ") || null;
  const attributeById = new Map(model.attributes.map((a) => [a.id, a]));
  const columnById = new Map(model.sourceColumns.map((c) => [c.id, c]));
  const entityById = new Map(model.entities.map((e) => [e.id, e]));
  const conceptById = new Map(model.concepts.map((c) => [c.id, c]));
  const tableById = new Map(model.sourceTables.map((t) => [t.id, t]));
  const systemById = new Map(model.sourceSystems.map((s) => [s.id, s]));
  const columnTable = (columnId: Uuid) => tableById.get(columnById.get(columnId)?.source_table_id ?? "");
  // a source row's BK badge and the Keys filter read the Business key classification (slice 7c, P11): one index per build
  const classes = indexOf(model);
  // open changes by column (slice 7b, item 24): another kind wins over a new column's
  const changeOf = new Map<Uuid, "new" | "chg">();
  for (const c of changes) {
    if (c.status !== "open" || c.deleted_at !== null || !c.source_column_id) continue;
    if (c.kind !== "new_column") changeOf.set(c.source_column_id, "chg");
    else if (!changeOf.has(c.source_column_id)) changeOf.set(c.source_column_id, "new");
  }

  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of model.mappingInputs) inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.source_column_id]);

  // Per row: how many mappings, any with a type problem, and the tooltip lines; and the mappings themselves.
  const info = new Map<Uuid, { n: number; warn: boolean; lines: string[] }>();
  const linksOf = new Map<Uuid, CardData["links"]>();
  const note = (rowId: Uuid, warn: boolean, line: string, link: CardData["links"][number]) => {
    const r = info.get(rowId) ?? { n: 0, warn: false, lines: [] };
    r.n++;
    r.warn ||= warn;
    r.lines.push(line);
    info.set(rowId, r);
    linksOf.set(rowId, [...(linksOf.get(rowId) ?? []), link]);
  };
  for (const m of model.mappings) {
    const attribute = attributeById.get(m.attribute_id);
    if (!attribute) continue;
    const columns = (inputsOf.get(m.id) ?? []).map((id) => columnById.get(id)).filter((c) => c !== undefined);
    // a retired input is historical: type problems come only through the live ones (slice 7b, Q10)
    const warn = !checkMappingTypes(m, attribute, columns.filter((c) => !c.retired_since)).ok;
    const attrLabel = `${entityById.get(attribute.entity_id)?.name ?? "?"}.${attribute.name}`;
    const link = { id: m.id, warn, draft: m.status === "draft" };
    note(attribute.id, warn, `from ${columns.map((c) => `${columnTable(c.id)?.name ?? "?"}.${c.name}`).join(" + ")}`, link);
    for (const c of columns) note(c.id, warn, `to ${attrLabel}`, link);
  }
  const rowState = (id: Uuid, empty: string) => {
    const r = info.get(id);
    return { mappings: r?.n ?? 0, warn: r?.warn ?? false, title: r ? r.lines.join("\n") : empty };
  };

  const cards: Omit<CardData, "clipName" | "clipLine1">[] = [];
  for (const item of items) {
    const base = {
      id: item.id,
      version: item.version,
      x: item.x,
      y: item.y,
      width: item.width,
      collapsed: item.collapsed,
      rowFilter: item.row_filter === "labeled" && !live ? "all" : item.row_filter,
      liveLevel: live ? item.live_level : null,
      liveTitle: null,
      frameId: item.frame_id,
      createdAt: item.created_at,
      ...(item.entity_names ? { entityNames: item.entity_names } : {}),
      ...(item.attribute_names ? { attributeNames: item.attribute_names } : {}),
    } as const;
    /** The distinct mappings of the given rows. */
    const links = (rows: readonly CardRow[]) => [...new Map(rows.flatMap((r) => linksOf.get(r.id) ?? []).map((l) => [l.id, l])).values()];
    if (item.entity_id) {
      const entity = entityById.get(item.entity_id);
      if (!entity) continue;
      const concept = conceptById.get(entity.concept_id);
      const rows: CardRow[] = model.attributes
        .filter((a) => a.entity_id === entity.id)
        .map((a) => ({
          id: a.id,
          name: a.name,
          ...(a.alias ? { alias: a.alias } : {}),
          type: cap(formatAttributeType(a)),
          pk: a.is_primary_key,
          fk: a.is_foreign_key,
          pii: a.is_pii,
          bk: a.is_business_key,
          ...rowState(a.id, "Not mapped yet"),
          clip: false,
          labels: labelsOf(`attribute:${a.id}`),
          ...(live ? { relevant: live.relevantRows.has(a.id) } : {}),
        }));
      cards.push({
        ...base,
        kind: "ent",
        targetId: entity.id,
        name: entity.name,
        ...(entity.alias ? { alias: entity.alias } : {}),
        line1: cap(entity.stereotype),
        // a context card says why it is here (prototype entCard, slice 3b)
        line1b: live && item.live_level === "context" ? "context only" : `in ${concept?.name ?? "–"}`,
        liveTitle: live && item.live_level === "context" ? `Context: the entity itself is not labeled ${live.labelName}, only some of its attributes are` : null,
        ...(live ? { liveRemove: live.removeOf({ kind: "entity", id: entity.id }) } : {}),
        color: concept?.color ?? null,
        rows,
        mapped: rows.filter((r) => r.mappings > 0).length,
        subject: { entityConceptId: entity.concept_id },
        links: links(rows),
        labels: labelsOf(`entity:${entity.id}`),
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
          bk: classes.has(c.id, "BK"),
          ...rowState(c.id, "Not used yet"),
          clip: false,
          labels: labelsOf(`source_column:${c.id}`),
          ...(live ? { relevant: live.relevantRows.has(c.id) } : {}),
          ...(c.retired_since ? { retired: true as const } : c.missing_since ? { missing: true as const } : changeOf.has(c.id) ? { change: changeOf.get(c.id)! } : {}),
        }));
      cards.push({
        ...base,
        kind: "src",
        targetId: table.id,
        name: table.name,
        line1: `${systemById.get(table.source_system_id)?.name ?? "?"} / ${table.database_name}.${table.schema_name}`,
        line1b: "",
        liveTitle: live && item.live_level === "context" ? `Context: the table itself is not labeled ${live.labelName}, only some of its columns or mappings are` : null,
        ...(live ? { liveRemove: live.removeOf({ kind: "source_table", id: table.id }) } : {}),
        color: null,
        rows,
        mapped: rows.filter((r) => r.mappings > 0).length,
        subject: { sourceSystemId: table.source_system_id },
        links: links(rows),
        labels: labelsOf(`source_table:${table.id}`),
      });
    }
  }
  return cards.map((c) => (canvas ? applyNames(withClips(c), canvas) : withClips(c))).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "src" ? -1 : 1));
}

/** Marks the names that may not fit, so only they are clipped (S1A-14); again whenever the width changes. */
export function withClips(card: Omit<CardData, "clipName" | "clipLine1">): CardData {
  const width = card.width ?? undefined;
  const dual = card.rows.some((r) => r.pk && r.fk);
  return {
    ...card,
    rows: card.rows.map((r) => ({ ...r, clip: rowNeedsClip({ ...r, name: shownText(r) }, card.kind, dual, width) })),
    clipName: titleNeedsClip(shownText(card), card.kind, `${card.mapped}/${card.rows.length}`, width),
    clipLine1: lineNeedsClip([card.line1, card.line1b].filter(Boolean), card.kind, width, !!card.labels),
  };
}

/** The canvas's names or aliases (slice 11): the two columns of its row. */
export type CanvasNames = Pick<Canvas, "entity_names" | "attribute_names">;

/** What a header or a row shows: its shown text, or its name (slice 11, F8). */
export const shownText = (named: { name: string; shown?: string }): string => named.shown ?? named.name;

/**
 * An entity card with the texts it shows under the canvas's names or aliases and its own exceptions (`cardShownNames`),
 * its clips worked out again for them; the same card when nothing it shows changes. Table cards are unchanged.
 */
export function applyNames(card: CardData, canvas: CanvasNames): CardData {
  if (card.kind !== "ent") return card;
  const item = { entity_names: card.entityNames ?? null, attribute_names: card.attributeNames ?? null };
  const { header, rows } = cardShownNames(item, canvas, { name: card.name, alias: card.alias ?? null }, card.rows.map((r) => ({ name: r.name, alias: r.alias ?? null })));
  const differs = (named: { name: string; shown?: string }, text: string) => shownText(named) !== text;
  if (!differs(card, header) && !card.rows.some((r, i) => differs(r, rows[i]!))) return card;
  const shown = <T extends { name: string; shown?: string }>(named: T, text: string): T => {
    const { shown: _old, ...rest } = named;
    void _old;
    return (text === named.name ? rest : { ...rest, shown: text }) as T;
  };
  return withClips({ ...shown(card, header), rows: card.rows.map((r, i) => shown(r, rows[i]!)) });
}

/** The rows a card shows under its filter (prototype rowsOf); a collapsed card shows none. */
export function visibleRows(card: Pick<CardData, "rows" | "collapsed" | "rowFilter">): CardRow[] {
  if (card.collapsed) return [];
  return card.rowFilter === "all" ? card.rows : card.rows.filter((r) => rowShown(r, card.rowFilter));
}
