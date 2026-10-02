"use client";

import { memo, useContext } from "react";
import { Handle, NodeResizeControl, Position, ResizeControlVariant, type Node, type NodeProps } from "@xyflow/react";
import { MAX_W, MIN_W, type Card, type Row } from "@/data/generate";
import { setHoverRow, toggleSelectedRow, useCardHl } from "./highlight";
import { CanvasCtx } from "./context";

export type RowFilter = "all" | "mapped" | "keys";

export type CardNodeData = {
  card: Card;
  collapsed: boolean;
  filter: RowFilter;
  mapped: Set<string>; // row ids with at least one mapping
};
export type CardNodeT = Node<CardNodeData, "card">;

/* Handle ids: "<rowId>:l" / "<rowId>:r" on every row, "h:l" / "h:r" on the header (re-anchor target). */
export const visibleRows = (d: CardNodeData): Row[] => {
  if (d.collapsed) return [];
  if (d.filter === "mapped") return d.card.rows.filter(r => d.mapped.has(r.id));
  if (d.filter === "keys") return d.card.rows.filter(r => r.pk || r.fk);
  return d.card.rows;
};

const FILTER_NEXT: Record<RowFilter, RowFilter> = { all: "mapped", mapped: "keys", keys: "all" };

function CardNode({ id, data, selected }: NodeProps<CardNodeT>) {
  const ctx = useContext(CanvasCtx);
  const { card } = data;
  const rows = visibleRows(data);
  const isSrc = card.kind === "src";
  const hl = useCardHl(id);
  const hlRows = hl.startsWith("on:") ? hl.slice(3).split(",") : [];
  const rowClass = (rid: string) => (hlRows.includes("*" + rid) ? " sel" : hlRows.includes(rid) ? " hl" : "");

  return (
    <div
      className={`card ${card.kind}${data.collapsed ? " collapsed" : ""}${selected ? " sel" : ""}${hl ? " lit" : ""}`}
      style={{ ["--cc" as string]: card.color }}
      data-card={id}
    >
      <div className="c-head">
        <Handle id="h:l" type="source" position={Position.Left} className="hnd hh" isConnectable={false} />
        <Handle id="h:r" type="source" position={Position.Right} className="hnd hh" isConnectable={false} />
        <div className="c-l1">
          <span className="stereo">{isSrc ? "Source" : "Entity"}</span>
          <span className={isSrc ? "path" : ""}>{card.sub}</span>
          <span className="c-tools nodrag">
            <button
              className="ib"
              title="Filter rows"
              data-act="filter"
              onClick={() => ctx.setFilter(id, FILTER_NEXT[data.filter])}
            >
              {data.filter}
            </button>
            <button
              className="ib"
              title={data.collapsed ? "Expand card" : "Collapse card"}
              data-act="collapse"
              onClick={() => ctx.toggleCollapse(id)}
            >
              {data.collapsed ? "▸" : "▾"}
            </button>
          </span>
        </div>
        <div className="c-l2">
          <span className="c-name">{card.name}</span>
          <span className="cov-t">
            {rows.length === card.rows.length ? card.rows.length : `${rows.length}/${card.rows.length}`}
          </span>
        </div>
      </div>
      {!data.collapsed && (
        <div
          className="c-body"
          onMouseOver={e => setHoverRow((e.target as HTMLElement).closest<HTMLElement>("[data-row]")?.dataset.row ?? null)}
          onMouseLeave={() => setHoverRow(null)}
          onClick={e => {
            const r = (e.target as HTMLElement).closest<HTMLElement>("[data-row]")?.dataset.row;
            if (r) toggleSelectedRow(r);
          }}
        >
          {rows.map(r => (
            <div className={`row${rowClass(r.id)}`} key={r.id} data-row={r.id}>
              <Handle id={`${r.id}:l`} type="source" position={Position.Left} className="hnd" isConnectable={false} />
              <span className="key">{r.pk ? <b className="pk">PK</b> : r.fk ? <b>FK</b> : null}</span>
              <span className="nm">{r.name}</span>
              <span className="dt">{r.dataType}</span>
              <Handle id={`${r.id}:r`} type="source" position={Position.Right} className="hnd" isConnectable={false} />
            </div>
          ))}
          {rows.length === 0 && <div className="row empty">No rows match the filter</div>}
        </div>
      )}
      {/* D-37: width 200–600 px by dragging the right edge; height stays content-driven */}
      <NodeResizeControl
        position="right"
        variant={ResizeControlVariant.Line}
        resizeDirection="horizontal"
        minWidth={MIN_W}
        maxWidth={MAX_W}
        className="c-rs"
      />
    </div>
  );
}

export default memo(CardNode);
