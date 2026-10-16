"use client";

// One card on the canvas: an entity or a source table with its rows (prototype entCard, srcCard, attrRow, colRow).
// AD-24: no React Flow handle per row (rows are positioned from data), and below 40 % zoom the body is one plain
// block of the same height instead of rows. Cards are dragged by their header (prototype .c-head, cursor: move).

import { memo, useContext } from "react";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import { visibleRows, type CardData, type CardRow } from "./card-data";
import { CanvasCardsCtx, DiagnosisCtx } from "./context";
import { BODY_PAD, LOD_ZOOM, ROW_H } from "./geometry";
import { splitName } from "./names";
import type { RequirementMark } from "./requirement-marks";
import { lineNeedsClip } from "./text-fit";

/**
 * `pinnedNotes`: the notes pinned to the card that are shown (slice 3a); `reqMark`: its requirement marker (slice 4b-1).
 * Both given by the canvas only when there are some.
 */
export type CardNodeT = Node<{ card: CardData; pinnedNotes?: number; reqMark?: RequirementMark }, "card">;

/** A card node, not a collapsed frame's block (slice 2c): React Flow holds both kinds. */
export const isCardNode = (n: Node): n is CardNodeT => n.type === "card";
/** The card nodes React Flow holds now, hidden ones (in a collapsed frame) included. */
export const cardNodesOf = (rf: { getNodes: () => Node[] }): CardNodeT[] => rf.getNodes().filter(isCardNode);

export const FILTER_LABEL = { all: "All", labeled: "Labeled", mapped: "Mapped", unmapped: "Unmapped", keys: "Keys" } as const;
export const FILTER_ORDER = ["all", "mapped", "unmapped", "keys"] as const;
/** On a live canvas an entity card also offers the rows its label makes relevant (prototype; slice 3b). */
export const LIVE_ENTITY_FILTER_ORDER = ["all", "labeled", "mapped", "unmapped", "keys"] as const;
/** The row filters a card offers. */
export const filtersOf = (card: Pick<CardData, "kind" | "liveLevel">): readonly (keyof typeof FILTER_LABEL)[] =>
  card.liveLevel !== null && card.kind === "ent" ? LIVE_ENTITY_FILTER_ORDER : FILTER_ORDER;

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

/**
 * The notes pinned to the card that are shown (prototype noteMark; resolved ones count while they are shown, Łukasz's
 * decision after step 4): a note icon, with their number when more than one; at every
 * zoom, like the rest of the header (slice 3a, item 12).
 */
const NoteMark = ({ n }: { n: number }) => (
  <i className="nmark" title={`${n} note${n > 1 ? "s" : ""} pinned here`} data-testid="mark-notes" data-count={n}>
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M3 2.5h10v7.5l-3.5 3.5H3z" />
      <path d="M13 10H9.5v3.5" />
    </svg>
    {n > 1 ? n : ""}
  </i>
);

/**
 * The tag mark of working labels (prototype lmark): a small outline tag, the label names as its tooltip (slice 3a). An
 * <i>, so the header's `span:nth-child(2)` rules (the concept text, its clip) never apply to it. One element: the tag is
 * a CSS mask (canvas.css), not an inline SVG, because every element in the viewport costs paint and layerize time on
 * each pan and zoom frame (slice 3a, S3A-14).
 */
const LabelMark = ({ labels }: { labels: string }) => <i className="lmark" title={`Working labels: ${labels}`} data-testid="mark-label" />;

/**
 * The requirement marker (slice 4b-1, PRD items 14–15; prototype reqMark, .rmark): a violet diamond and the number of
 * requirements the card's panel lists, the list as its tooltip; at every zoom, like the rest of the header. One element
 * (the diamond is its ::before, canvas.css). A click on it does nothing, not even select the card.
 */
const RequirementMarker = ({ mark }: { mark: RequirementMark }) => (
  <i className="rmark" title={mark.title} data-testid="mark-requirements" data-count={mark.n}>
    {mark.n}
  </i>
);

function keyTitle(r: CardRow) {
  if (r.pk && r.fk) return "Primary key and foreign key";
  return r.pk ? "Primary key" : "Foreign key";
}

function Row({ row, kind, selected }: { row: CardRow; kind: CardData["kind"]; selected: boolean }) {
  const { head, tail } = splitName(row.name);
  const status = row.mappings === 0 ? "" : row.warn ? " warn" : " ok";
  return (
    <div
      className={`row${selected ? " sel" : ""}${row.relevant ? " lab" : ""}`}
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
      {row.labels && <LabelMark labels={row.labels} />}
      <span className="dt">{row.type}</span>
      <span className={`st${status}${row.mappings > 1 ? " n" : ""}`} data-testid="dot-mapped" title={row.title}>
        {row.mappings > 1 ? row.mappings : ""}
      </span>
    </div>
  );
}

function CardNode({ data }: NodeProps<CardNodeT>) {
  const { card, pinnedNotes = 0, reqMark } = data;
  const ctx = useContext(CanvasCardsCtx);
  const blocks = !!useContext(DiagnosisCtx).blocks;
  const lod = useStore((s) => blocks || s.transform[2] < LOD_ZOOM);
  const rows = visibleRows(card);
  const isEnt = card.kind === "ent";
  const dual = rows.some((r) => r.pk && r.fk);
  const total = card.rows.length;
  const label = FILTER_LABEL[card.rowFilter];
  const sel = ctx.selection;
  const cardSelected = sel?.t === "card" && sel.id === card.id;
  const selectedRow = sel?.t === "row" && sel.cardId === card.id ? sel.id : null;
  // the open-notes mark takes room in the first line too (slice 3a): checked only on cards that have one
  const clipLine1 =
    card.clipLine1 ||
    ((pinnedNotes > 0 || !!reqMark) && lineNeedsClip([card.line1, card.line1b].filter(Boolean), card.kind, card.width ?? undefined, !!card.labels, pinnedNotes, reqMark?.n ?? 0));

  // A click on a row selects the row, anywhere else on the card the card; the card tools do their own thing.
  // Shift+click anywhere on the card puts the card in or out of a selection of several (slice 2a).
  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".c-tools")) return;
    // the requirement marker does nothing on a click (PRD item 14)
    if (target.closest(".rmark")) return;
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
      className={`card ${card.kind}${card.collapsed ? " collapsed" : ""}${dual ? " dualkeys" : ""}${cardSelected ? " sel" : ""}${card.clipName ? " clip-name" : ""}${clipLine1 ? " clip-l1" : ""}${card.liveLevel === "context" ? " ctx" : ""}`}
      title={card.liveTitle ?? undefined}
      style={isEnt ? ({ "--cc": card.color ?? "#888899" } as React.CSSProperties) : undefined}
      data-testid={isEnt ? "card-entity" : "card-source"}
      data-card={card.id}
      data-collapsed={card.collapsed || undefined}
      data-live={card.liveLevel ?? undefined}
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
          {card.labels && <LabelMark labels={card.labels} />}
          {pinnedNotes > 0 && <NoteMark n={pinnedNotes} />}
          {reqMark && <RequirementMarker mark={reqMark} />}
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
