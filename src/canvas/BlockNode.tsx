"use client";

// A collapsed frame drawn as one block (slice 2c, D-07; prototype blockCard, .fblock): a React Flow node of its own kind
// at the frame's top-left corner, as wide as the prototype's block and as high as its rows need (BLOCK in the domain).
// Header: the kind, “collapsed, N cards”, an “Expand” button and the name. Body: up to six cards with their mapped or
// used count, then “and N more”, or “Empty frame”; below 40 % a plain body (AD-24 rule 1). Footer: the frame's chips.
// The block stands for the frame: its header moves the frame with its hidden cards and selects it (the frame's own
// press, key frame:<id>), a double-click on it or “Expand” expands it, a click on a card row expands the frame and
// selects that card. Text keeps its size like a card's: it scales with the canvas (no zoom variable).

import { memo, useContext, type CSSProperties } from "react";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import { BLOCK, blockHeight } from "@/domain/model/frames";
import { CanvasCardsCtx } from "./context";
import type { FrameChip, FrameData } from "./frame-data";
import { LOD_ZOOM } from "./geometry";

export interface BlockMember {
  id: Uuid;
  kind: "ent" | "src";
  name: string;
  /** Attributes mapped or columns used, of all its rows. */
  mapped: number;
  total: number;
}

export type BlockNodeT = Node<{ frame: FrameData; color: string; members: BlockMember[]; chips: FrameChip[]; selected: boolean }, "block">;

/** The React Flow id of a frame's block. */
export const blockNodeId = (frameId: Uuid) => `block:${frameId}`;

const KIND_LABEL = { concept: "Concept", source_system: "Source system", free: "Free area" } as const;
const KIND_CLASS = { concept: "concept", source_system: "source", free: "free" } as const;

const GrowIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path d="M6.5 6.5l-4-4M2.5 6V2.5H6M9.5 9.5l4 4M13.5 10v3.5H10" />
  </svg>
);

function BlockNode({ data }: NodeProps<BlockNodeT>) {
  const { frame: f, color, members, chips, selected } = data;
  const ctx = useContext(CanvasCardsCtx);
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const n = members.length;
  const shown = members.slice(0, BLOCK.maxRows);
  const rows = Math.max(1, Math.min(n, BLOCK.maxRows) + (n > BLOCK.maxRows ? 1 : 0));
  const expand = () => ctx.setFrameCollapsed(f.id, false);

  return (
    <div
      className={`card fblock ${KIND_CLASS[f.kind]}${selected ? " sel" : ""}`}
      style={{ "--fc": color, width: BLOCK.width, height: blockHeight(n) } as CSSProperties}
      data-frame={f.id}
      data-testid="block"
      data-block={f.id}
      aria-selected={selected || undefined}
    >
      <div
        className="c-head"
        title="Drag to move, double-click to expand"
        data-testid="block-head"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".c-tools")) return;
          ctx.framePress(e, f.id);
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest(".c-tools")) return;
          expand();
        }}
      >
        <div className="c-l1">
          <span className="stereo">{KIND_LABEL[f.kind]}</span>
          <span data-testid="block-count">
            collapsed, {n} card{n === 1 ? "" : "s"}
          </span>
          {ctx.canCollapse && (
            <span className="c-tools nodrag">
              <button type="button" className="ib" data-testid="button-block-expand" title="Expand the frame" onPointerDown={(e) => e.stopPropagation()} onClick={expand}>
                <GrowIcon />
                Expand
              </button>
            </span>
          )}
        </div>
        <div className="c-l2">
          <span className="c-name" data-testid="block-name" title={f.name}>
            {f.name}
          </span>
        </div>
      </div>
      {lod ? (
        <div className="c-lod" style={{ height: BLOCK.bodyPad * 2 + rows * BLOCK.rowHeight }}>
          <div className="c-block" />
        </div>
      ) : (
        <div className="b-body" onPointerDown={(e) => e.stopPropagation()}>
          {shown.map((m) => (
            <div
              key={m.id}
              className="brow"
              data-testid="block-member"
              data-member={m.id}
              title="Expand the frame and show this card"
              onClick={() => ctx.openMember(f.id, m.id)}
            >
              <span className={`bk ${m.kind}`} />
              <span className={`nm${m.kind === "src" ? " mono" : ""}`}>{m.name}</span>
              <span className="dt">
                {m.mapped}/{m.total}
              </span>
            </div>
          ))}
          {n > BLOCK.maxRows && (
            <div className="brow more" data-testid="block-more">
              and {n - BLOCK.maxRows} more
            </div>
          )}
          {n === 0 && (
            <div className="brow none" data-testid="block-empty">
              Empty frame
            </div>
          )}
        </div>
      )}
      <div className="b-foot" data-testid="block-chips">
        {chips.map((c) => (
          <span key={c.text} className={`f-chip${c.tone === "warn" ? " w" : ""}`} title={c.title} data-testid="block-chip">
            {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(BlockNode);
