"use client";

import { memo, useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BODY_PAD, HEAD_H, type Card, type Frame } from "@/data/generate";
import { CanvasCtx } from "./context";

export type FrameNodeData = {
  frame: Frame;
  members: Card[];
  collapsed: boolean;
  /** lines leaving the frame, shown in the collapsed block's footer */
  outside: { maps: number; rels: number };
};
export type FrameNodeT = Node<FrameNodeData, "frame">;

/* Collapsed block geometry, from the prototype (BW, blockH). */
export const BLOCK_W = 280;
const BROW_H = 22, FOOT_H = 30, SHOWN = 6;
export const blockH = (n: number) => HEAD_H + BODY_PAD * 2 + Math.max(1, Math.min(n, SHOWN) + (n > SHOWN ? 1 : 0)) * BROW_H + FOOT_H;

function FrameNode({ id, data, selected }: NodeProps<FrameNodeT>) {
  const ctx = useContext(CanvasCtx);
  const { frame, members, collapsed } = data;
  const nSrc = members.filter(m => m.kind === "src").length;
  const toggle = (
    <button className="ib nodrag" data-act="frame-collapse" title={collapsed ? "Expand frame" : "Collapse frame"}
      onClick={() => ctx.toggleFrame(id)}>
      {collapsed ? "Expand" : "Collapse"}
    </button>
  );
  const handles = (
    <>
      <Handle id="h:l" type="source" position={Position.Left} className="hnd" isConnectable={false} />
      <Handle id="h:r" type="source" position={Position.Right} className="hnd" isConnectable={false} />
    </>
  );

  if (collapsed) {
    return (
      <div className={`card fblock${selected ? " sel" : ""}`} style={{ ["--fc" as string]: frame.color }} data-frame={id}>
        <div className="c-head">
          {handles}
          <div className="c-l1"><span className="stereo">Frame</span><span>{members.length} cards</span><span className="c-tools">{toggle}</span></div>
          <div className="c-l2"><span className="c-name">{frame.name}</span></div>
        </div>
        <div className="b-body">
          {members.slice(0, SHOWN).map(m => (
            <div className="brow" key={m.id}>
              <span className={`bk${m.kind === "ent" ? " ent" : ""}`} />
              <span className="nm">{m.name}</span>
              <span className="dt">{m.rows.length}</span>
            </div>
          ))}
          {members.length > SHOWN && <div className="brow more">+ {members.length - SHOWN} more</div>}
        </div>
        <div className="b-foot">
          {nSrc} sources · {members.length - nSrc} entities · {data.outside.maps} mappings out · {data.outside.rels} relationships
        </div>
      </div>
    );
  }

  return (
    <div className={`frame${selected ? " sel" : ""}`} style={{ ["--fc" as string]: frame.color }} data-frame={id}>
      {handles}
      <div className="f-lab">
        <span className="f-dot" />
        <span className="f-name">{frame.name}</span>
        <span className="f-kind">{members.length} cards</span>
        {toggle}
      </div>
    </div>
  );
}

export default memo(FrameNode);
