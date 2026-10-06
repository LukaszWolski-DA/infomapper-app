"use client";

// One card on the canvas: an entity or a source table with its rows (prototype entCard, srcCard, attrRow, colRow).
// AD-24: no React Flow handle per row (rows are positioned from data), and below 40 % zoom the body is one plain
// block of the same height instead of rows. Cards are dragged by their header (prototype .c-head, cursor: move).

import { memo, useContext } from "react";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import { visibleRows, type CardData, type CardRow } from "./card-data";
import { CanvasCardsCtx } from "./context";
import { BODY_PAD, LOD_ZOOM, ROW_H } from "./geometry";
import { splitName } from "./names";

export type CardNodeT = Node<{ card: CardData }, "card">;

export const FILTER_LABEL = { all: "All", mapped: "Mapped", unmapped: "Unmapped", keys: "Keys" } as const;
export const FILTER_ORDER = ["all", "mapped", "unmapped", "keys"] as const;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path d={d} />
  </svg>
);
const ICON = {
  filter: "M2.5 3.5h11l-4.2 5v4l-2.6 1v-5z",
  up: "M4.5 10l3.5-3.5 3.5 3.5",
  down: "M4.5 6.5L8 10l3.5-3.5",
};

function keyTitle(r: CardRow) {
  if (r.pk && r.fk) return "Primary key and foreign key";
  return r.pk ? "Primary key" : "Foreign key";
}

function Row({ row, kind, selected }: { row: CardRow; kind: CardData["kind"]; selected: boolean }) {
  const { head, tail } = splitName(row.name);
  const status = row.mappings === 0 ? "" : row.warn ? " warn" : " ok";
  return (
    <div
      className={`row${selected ? " sel" : ""}`}
      data-testid={kind === "ent" ? "row-attribute" : "row-column"}
      data-row={row.id}
      aria-selected={selected || undefined}
    >
      <span className="key" title={row.pk || row.fk ? keyTitle(row) : undefined}>
        {row.pk && <b className="pk">PK</b>}
        {row.fk && <b>FK</b>}
      </span>
      <span className={`nm${row.clip ? " clip" : ""}`} title={row.name}>
        <span className="a">{head}</span>
        {tail && <span className="b">{tail}</span>}
      </span>
      {row.pii && (
        <span className="tag pii" title="Personal data">
          PII
        </span>
      )}
      {row.bk && (
        <span className="tag bk" title="Business key">
          BK
        </span>
      )}
      <span className="dt">{row.type}</span>
      <span className={`st${status}${row.mappings > 1 ? " n" : ""}`} data-testid="dot-mapped" title={row.title}>
        {row.mappings > 1 ? row.mappings : ""}
      </span>
    </div>
  );
}

function CardNode({ data }: NodeProps<CardNodeT>) {
  const { card } = data;
  const ctx = useContext(CanvasCardsCtx);
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const rows = visibleRows(card);
  const isEnt = card.kind === "ent";
  const dual = rows.some((r) => r.pk && r.fk);
  const total = card.rows.length;
  const label = FILTER_LABEL[card.rowFilter];
  const sel = ctx.selection;
  const cardSelected = sel?.t === "card" && sel.id === card.id;
  const selectedRow = sel?.t === "row" && sel.cardId === card.id ? sel.id : null;

  // A click on a row selects the row, anywhere else on the card the card; the card tools do their own thing.
  // Shift+click anywhere on the card puts the card in or out of a selection of several (slice 2a).
  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".c-tools")) return;
    if (e.shiftKey) {
      ctx.toggleCard(card.id);
      return;
    }
    const row = target.closest<HTMLElement>("[data-row]")?.dataset.row;
    ctx.select(row ? { t: "row", cardId: card.id, id: row } : { t: "card", id: card.id });
  };

  return (
    <div
      onClick={onClick}
      className={`card ${card.kind}${card.collapsed ? " collapsed" : ""}${dual ? " dualkeys" : ""}${cardSelected ? " sel" : ""}${card.clipName ? " clip-name" : ""}${card.clipLine1 ? " clip-l1" : ""}`}
      style={isEnt ? ({ "--cc": card.color ?? "#888899" } as React.CSSProperties) : undefined}
      data-testid={isEnt ? "card-entity" : "card-source"}
      data-card={card.id}
      data-collapsed={card.collapsed || undefined}
      data-filter={card.rowFilter}
      aria-selected={cardSelected || undefined}
    >
      <div className="c-head">
        <div className="c-l1">
          {isEnt ? (
            <>
              <span className="stereo">{card.line1}</span>
              <span>{card.line1b}</span>
            </>
          ) : (
            <span className="path">{card.line1}</span>
          )}
          {ctx.editable && (
            <span className="c-tools nodrag">
              {isEnt && (
                <button
                  type="button"
                  className="ib"
                  data-testid="button-card-relate"
                  data-relate={card.id}
                  title="Draw a relationship from this entity"
                  onClick={() => ctx.startRelate(card.id)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <rect x="1.5" y="4.5" width="4.5" height="7" rx="1" />
                    <rect x="10" y="4.5" width="4.5" height="7" rx="1" />
                    <path d="M6 8h4" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="ib"
                data-testid="button-card-filter"
                title={`Show: ${label} (click to change)`}
                onClick={() => ctx.cycleFilter(card.id)}
              >
                <Icon d={ICON.filter} />
                {label}
              </button>
              <button
                type="button"
                className="ib"
                data-testid="button-card-collapse"
                title={card.collapsed ? "Expand" : "Collapse"}
                aria-expanded={!card.collapsed}
                onClick={() => ctx.toggleCollapse(card.id)}
              >
                <Icon d={card.collapsed ? ICON.down : ICON.up} />
              </button>
            </span>
          )}
        </div>
        <div className="c-l2">
          <span className="c-name" data-testid="card-name" title={card.name}>
            {card.name}
          </span>
          <span className="cov" title={`${card.mapped} of ${total} ${isEnt ? "attributes mapped" : "columns used"}`}>
            <i style={{ width: `${total ? (card.mapped / total) * 100 : 0}%` }} />
          </span>
          <span className="cov-t">
            {card.mapped}/{total}
          </span>
        </div>
      </div>
      {ctx.editable && (
        <div
          className="c-rs nodrag"
          data-resize={card.id}
          data-testid="handle-card-width"
          title="Drag to change the width; double-click to fit the names"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            ctx.fitWidth(card.id);
          }}
        />
      )}
      {!card.collapsed && lod && (
        <div className="c-lod" data-testid="card-block" title={card.name} style={{ height: BODY_PAD * 2 + Math.max(1, rows.length) * ROW_H }}>
          <div className="c-block" />
        </div>
      )}
      {!card.collapsed && !lod && (
        <div className="c-body">
          {rows.map((r) => (
            <Row key={r.id} row={r} kind={card.kind} selected={r.id === selectedRow} />
          ))}
          {rows.length === 0 && (
            <div className="row empty">
              {total === 0 && isEnt ? "No attributes yet. Add them in the panel, or drag a source column here." : `Nothing matches “${label}”`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CardNode);
