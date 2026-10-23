"use client";

// Source table and column panels (prototype insSource, insCol). A table: path, columns and where they go, the entities
// it feeds, “Remove from this canvas”, delete (refused while a mapping reads one of its columns). A column: path,
// type, BK and PII flags, comment, the mappings it feeds, and “Map to an attribute” (slice 1b, D-48). Name, type and
// position come from the source. Slice 7a (items 35, 36): the table's kind line with its system, its comment from the
// source, “Missing from source since”, missing columns last and struck through, and its relationships between source
// tables; a column's “Missing from source since”.

import { useContext, useRef } from "react";
import { deleteSourceTableAction, updateSourceColumnAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { formatColumnType } from "@/domain/model/type-check";
import type { SourceColumn, SourceRelationship, SourceTable } from "@/domain/types";
import { STATUS_LABEL } from "./attribute-panel";
import { Actions, buttonClass, ConfirmDelete, dangerClass, Field, Flag, Fold, GroupedSelect, Hint, Kind, Li, LongList, smallButtonClass, TextField, TypeDot } from "./fields";
import { usePanel } from "./inspector";
import { ItemLabels } from "./item-labels";
import { OnCanvases } from "./on-canvases";
import { CardFrame } from "./card-frame";
import { NotesHere } from "./notes-here";
import { attributeLabel, attributeOptions, fedEntities, mappingsOfColumn, tablePath, typeCheckOf } from "./model-index";
import { RequirementsSection } from "./requirements-section";
import { day } from "./import/wizard-model";

/** “Missing from source since 2026-10-23” (slice 7a; the review's date format). */
function MissingSince({ since }: { since: string | null }) {
  if (!since) return null;
  return (
    <p className="mt-1.5">
      <span className="rounded bg-im-warn-soft px-1.5 py-px text-xs text-im-warn" data-testid="tag-missing">
        Missing from source since {day(since)}
      </span>
    </p>
  );
}

const KIND_OF: Record<SourceTable["object_type"], (t: SourceTable) => string> = {
  table: () => "Source table",
  view: () => "Source view",
  file: (t) => `Source file${t.file_format ? ` (${t.file_format})` : ""}`,
};

/** `cardId` is null when the table has no card on this canvas (a go-to link's fallback, slice 4a). */
export function SourceTablePanel({ table: t, cardId }: { table: SourceTable; cardId: Uuid | null }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const columns = p.ix.columnsOf.get(t.id) ?? [];
  /** Missing columns last (slice 7a, item 35), otherwise in physical order. */
  const listed = [...columns].sort((a, b) => Number(!!a.missing_since) - Number(!!b.missing_since) || a.ordinal - b.ordinal);
  /** Relationships from and to the table: they go with it (slice 7a, D-47). */
  const tableRelationships = p.ix.relationshipsOf.get(t.id) ?? [];
  const relationships = tableRelationships.length;
  const system = p.ix.model.sourceSystems.find((s) => s.id === t.source_system_id);
  const feeds = fedEntities(p.ix, t.id);
  /** Fed entities not on this canvas, to place on the right of the card (B-08). */
  const missing = feeds
    .filter((f) => !p.cardOf(f.entity.id))
    .map((f) => ({ target: { entityId: f.entity.id }, rows: (p.ix.attributesOf.get(f.entity.id) ?? []).length }));
  const goes = (c: SourceColumn) => mappingsOfColumn(p.ix, c.id).map((m) => attributeLabel(p.ix, m.attribute_id));

  async function remove() {
    const result = await run(
      () => deleteSourceTableAction(p.workspaceId, { sourceTableId: t.id, expectedVersion: t.version }),
      columns.length ? `Deleted ${t.name} with its ${columns.length} column${columns.length === 1 ? "" : "s"}.` : `Deleted ${t.name}.`,
      { undoable: true },
    );
    if (result.ok) ui.select(null);
  }

  return (
    <div data-testid="panel-source-table">
      <Kind>
        <span data-testid="source-table-kind">
          {KIND_OF[t.object_type](t)} of{" "}
          {system ? (
            <button type="button" className="rounded-md bg-im-physical-soft px-1.5 py-px text-im-physical" onClick={() => p.goSystem(system.id)} data-testid="button-table-system">
              {system.name}
            </button>
          ) : (
            "?"
          )}
        </span>
      </Kind>
      <h2 className="font-mono text-[15px] font-semibold leading-tight">{t.name}</h2>
      <p className="mt-1 font-mono text-im-ink-3" data-testid="source-table-path">
        {t.database_name}.{t.schema_name}
      </p>
      {(t.row_count !== null || t.comment) && (
        <Hint>
          <span data-testid="source-table-facts">
            {t.row_count !== null && `${t.row_count.toLocaleString("en")} rows`}
            {t.row_count !== null && t.comment && " · "}
            {t.comment && (
              <>
                <span className="text-im-ink-3">From the source:</span> {t.comment}
              </>
            )}
          </span>
        </Hint>
      )}
      <MissingSince since={t.missing_since} />
      <ItemLabels target={{ kind: "source_table", id: t.id }} />

      <Fold title="Columns and where they go" count={columns.length}>
        <LongList
          items={listed}
          testId="list-table-columns"
          text={(c) => `${c.name} ${goes(c).join(" ")}`}
          render={(c) => {
            const targets = goes(c);
            return (
              <Li
                key={c.id}
                onClick={() => ui.select(cardId ? { t: "row", cardId, id: c.id } : { t: "element", kind: "source_column", id: c.id })}
                meta={c.missing_since ? "missing" : targets.length ? targets.join(", ") : <span className="italic">not used</span>}
                testId={c.missing_since ? "column-missing" : undefined}
              >
                <span className={`font-mono text-xs ${c.missing_since ? "line-through decoration-im-warn" : ""}`}>{c.name}</span>
              </Li>
            );
          }}
        />
      </Fold>

      <Fold title="Relationships between source tables" count={relationships}>
        {relationships ? (
          <LongList
            items={tableRelationships}
            testId="list-table-relationships"
            text={(r) => r.name}
            render={(r) => <RelationshipLi key={r.id} r={r} tableId={t.id} />}
          />
        ) : (
          <Hint>None known. They come from foreign keys in an import.</Hint>
        )}
      </Fold>

      <Fold title="Feeds entities" count={feeds.length}>
        {feeds.length ? (
          <LongList
            items={feeds}
            text={(f) => f.entity.name}
            render={({ entity, mappings }) => {
              const here = p.cardOf(entity.id);
              const dot = here ? "bg-im-logical" : p.elsewhere(entity.id) ? "shadow-[inset_0_0_0_1.5px_var(--im-ink-3)]" : "";
              return (
                <Li
                  key={entity.id}
                  title={here ? "On this canvas. Click to show it." : "Click to place it next to this card."}
                  onClick={() =>
                    here
                      ? p.goEntity(entity.id)
                      : cardId
                        ? ui.placeBeside([{ target: { entityId: entity.id }, rows: (p.ix.attributesOf.get(entity.id) ?? []).length }], cardId, "right")
                        : ui.place({ entityId: entity.id }, (p.ix.attributesOf.get(entity.id) ?? []).length)
                  }
                  meta={`${mappings} mapping${mappings === 1 ? "" : "s"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-[7px] flex-none rounded-full ${dot}`} />
                    <span className="truncate">{entity.name}</span>
                  </span>
                </Li>
              );
            }}
          />
        ) : (
          <Hint>This table does not feed any entity yet.</Hint>
        )}
        {p.editable && cardId && missing.length > 0 && (
          <div className="mt-2 flex gap-2">
            <button type="button" className={smallButtonClass} onClick={() => ui.placeBeside(missing, cardId, "right")} data-testid="button-feed-all">
              {missing.length === feeds.length ? "Add all to this canvas" : `Add the ${missing.length} missing to this canvas`}
            </button>
          </div>
        )}
      </Fold>

      <RequirementsSection target={{ kind: "source_table", id: t.id }} />
      {cardId && <NotesHere pin={{ cardId }} />}
      <OnCanvases kind="source" targetId={t.id} cardId={cardId} />
      {cardId && <CardFrame cardId={cardId} kind="src" />}

      {p.editable && (
        <Actions>
          {cardId ? (
            <button type="button" className={buttonClass} onClick={() => ui.remove(cardId)} data-testid="button-remove-card">
              {p.live ? "Remove from this canvas (unlabel)…" : "Remove from this canvas"}
            </button>
          ) : (
            // slice 4b-2, item 16 (prototype add-card): where “Remove from this canvas” stands when the card is not here
            <button type="button" className={buttonClass} onClick={() => ui.addToCanvas({ sourceTableId: t.id }, columns.length)} data-testid="button-add-card">
              Add to this canvas
            </button>
          )}
          {columns.length ? (
            // With columns it still asks (slice 1b, item 13).
            <ConfirmDelete
              label="Delete table"
              also={[`${columns.length} column${columns.length === 1 ? "" : "s"}`, ...(relationships ? [`${relationships} relationship${relationships === 1 ? "" : "s"}`] : [])].join(", ")}
              onConfirm={() => void remove()}
              testId="button-delete-table"
            />
          ) : (
            <button type="button" className={dangerClass} onClick={() => void remove()} data-testid="button-delete-table">
              Delete table
            </button>
          )}
        </Actions>
      )}
    </div>
  );
}

/**
 * A relationship of a table (prototype sourceBody): from it, “cust_id → dbo.customers” and its name; to it,
 * “dbo.customer_addresses.cust_id → here”. A click goes to the table at the other end.
 */
function RelationshipLi({ r, tableId }: { r: SourceRelationship; tableId: string }) {
  const p = usePanel();
  const pairs = p.ix.model.sourceRelationshipColumns.filter((x) => x.source_relationship_id === r.id).sort((a, b) => a.sort_order - b.sort_order);
  const name = (id: string) => p.ix.column.get(id)?.name ?? "?";
  const path = (id: string) => {
    const t = p.ix.table.get(id);
    return t ? `${t.schema_name}.${t.name}` : "?";
  };
  const from = pairs.map((x) => name(x.from_column_id)).join(", ");
  const outgoing = r.source_table_id === tableId;
  return (
    <Li onClick={() => p.goTable(outgoing ? r.to_source_table_id : r.source_table_id)} meta={`${r.name}${r.missing_since ? " · missing" : ""}`} testId="table-relationship">
      <span className="font-mono text-xs">{outgoing ? `${from} → ${path(r.to_source_table_id)}` : `${path(r.source_table_id)}.${from} → here`}</span>
    </Li>
  );
}

/** A column, with or without its table's card on this canvas; the table chip goes to the table (slice 4a fallback). */
export function SourceColumnPanel({ column: c }: { column: SourceColumn }) {
  const p = usePanel();
  const { run } = useAction();
  const table = p.ix.table.get(c.source_table_id)!;
  const mappings = mappingsOfColumn(p.ix, c.id);
  const ref = { sourceColumnId: c.id, expectedVersion: c.version };
  /** Where the D-48 choice opens: under the attribute picker. */
  const mapAt = useRef({ x: 0, y: 0 });
  const save = (change: { isBusinessKey?: boolean; isPii?: boolean; comment?: string | null }) =>
    void run(() => updateSourceColumnAction(p.workspaceId, { ...ref, ...change }));

  const facts = [formatColumnType(c), c.is_nullable ? "nullable" : "required", c.is_primary_key ? "primary key" : null, c.is_foreign_key ? "foreign key" : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div data-testid="panel-source-column">
      <Kind>
        Column of{" "}
        <button
          type="button"
          className="rounded-md bg-im-physical-soft px-1.5 py-px font-mono text-im-physical"
          onClick={() => p.goTable(table.id)}
        >
          {table.name}
        </button>
      </Kind>
      <h2 className="font-mono text-[15px] font-semibold leading-tight">{c.name}</h2>
      <p className="mt-1 font-mono text-im-ink-3">
        {tablePath(p.ix, table)}.{table.name}
      </p>
      <Hint>
        <span className="font-mono text-xs" data-testid="source-column-facts">
          {facts}
        </span>
      </Hint>
      <MissingSince since={c.missing_since} />
      <Field label="Flags">
        <div className="flex flex-wrap gap-1.5" data-testid="flags-column">
          <Flag on={c.is_business_key} label="Business key" disabled={!p.editable} onToggle={() => save({ isBusinessKey: !c.is_business_key })} />
          <Flag on={c.is_pii} label="Personal data" disabled={!p.editable} onToggle={() => save({ isPii: !c.is_pii })} />
        </div>
      </Field>
      <Field label="Comment" htmlFor="f-cc">
        <TextField
          key={`${c.id}:${c.version}`}
          id="f-cc"
          value={c.comment ?? ""}
          readOnly={!p.editable}
          onSave={(comment) => save({ comment: comment || null })}
          testId="input-column-comment"
        />
      </Field>

      <Fold title="Feeds" count={mappings.length}>
        {mappings.length ? (
          <LongList
            items={mappings}
            text={(m) => attributeLabel(p.ix, m.attribute_id)}
            render={(m) => (
              <Li key={m.id} onClick={() => p.goMapping(m.id)} meta={STATUS_LABEL[m.status]}>
                <span className="flex items-center gap-2">
                  <TypeDot ok={typeCheckOf(p.ix, m).ok} />
                  <span className="truncate">{attributeLabel(p.ix, m.attribute_id)}</span>
                </span>
              </Li>
            )}
          />
        ) : (
          <Hint>Not used yet. Drag it onto an attribute, or onto an entity’s header to create a new attribute from it.</Hint>
        )}
      </Fold>
      <ItemLabels target={{ kind: "source_column", id: c.id }} />
      <RequirementsSection target={{ kind: "source_column", id: c.id }} />

      {p.editable && (
        <Field label="Map to an attribute" htmlFor="f-adda">
          <div
            onChangeCapture={(e) => {
              const r = (e.target as HTMLElement).getBoundingClientRect();
              mapAt.current = { x: r.left, y: r.bottom };
            }}
          >
            <GroupedSelect
              id="f-adda"
              placeholder="Choose an attribute…"
              groups={attributeOptions(p.ix, p.entitiesHere)}
              onPick={(attributeId) => p.mapColumn(c.id, attributeId, mapAt.current)}
              testId="select-map-to-attribute"
            />
          </div>
        </Field>
      )}
    </div>
  );
}
