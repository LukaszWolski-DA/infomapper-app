"use client";

// The Overview in the bottom-right corner (prototype .mini): a header with the zoom value and a toggle (M), and the
// whole canvas in miniature; dragging or clicking in it moves the view. Entities in their concept colour, sources in
// the physical colour.

import { useContext } from "react";
import { MiniMap, Panel, useStore, type Node } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx } from "./context";

const nodeColor = (n: Node) => {
  const card = (n as CardNodeT).data.card;
  return card.kind === "ent" ? (card.color ?? "#888899") : "var(--im-physical)";
};
const nodeClass = (n: Node) => ((n as CardNodeT).data.card.kind === "ent" ? "mini-ent" : "mini-src");

export function Overview() {
  const ui = useContext(CanvasUiCtx);
  const zoom = useStore((s) => s.transform[2]);
  return (
    <Panel position="bottom-right" className={`overview${ui.overviewOpen ? "" : " closed"}`} data-testid="panel-overview">
      <div className="overview-h" onDoubleClick={ui.toggleOverview}>
        <span>Overview</span>
        <span className="overview-z">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="ib"
          data-testid="button-overview-toggle"
          aria-expanded={ui.overviewOpen}
          title={ui.overviewOpen ? "Hide the overview (M)" : "Show the overview (M)"}
          onClick={ui.toggleOverview}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M4.5 6.5L8 10l3.5-3.5" />
          </svg>
        </button>
      </div>
      {ui.overviewOpen && (
        <MiniMap
          pannable
          zoomable
          ariaLabel="Overview of the whole canvas"
          nodeColor={nodeColor}
          nodeClassName={nodeClass}
          nodeStrokeWidth={0}
          nodeBorderRadius={0}
          maskColor="transparent"
          maskStrokeColor="var(--im-logical)"
          maskStrokeWidth={1.5}
          bgColor="var(--im-canvas)"
          style={{ width: 216, height: 140 }}
        />
      )}
    </Panel>
  );
}
