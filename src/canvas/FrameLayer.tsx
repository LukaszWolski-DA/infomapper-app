"use client";

// The frames of a canvas (slice 2b; prototype renderFrames, .frame, .f-lab, .f-rs). Frames are not React Flow nodes
// and not parents of cards: they are one layer inside the viewport, painted under the lines and the cards (z-index −1
// in the viewport's stacking context), in a fixed order that hover, drag, relate and selection never change. Smaller
// frames come later, so where frames overlap the smaller one is on top, as membership is (D-05).
// What counts as the frame: its name strip above it, its resize handle and its empty area. Everything on top of it
// (cards, lines) is hit first. Right drag, the middle button, Space + drag and the wheel reach React Flow's panning,
// because nothing here is marked `nopan`. The label keeps its size on the screen at every zoom (prototype --iz); below
// 40 % the chips are left out (AD-24 rule 1). Fills are a colour mixed in CSS, never `opacity` (AD-24 rule 4).

import { memo, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelRenderer, useStore } from "@xyflow/react";
import type { Uuid } from "@/domain/ids";
import type { CardData } from "./card-data";
import { frameChips, frameColor, frameStats, type FrameData } from "./frame-data";
import { LOD_ZOOM, type Rect } from "./geometry";

export type FramePart = "label" | "body" | "handle";

interface Props {
  frames: readonly FrameData[];
  /** The cards with their frames as the canvas has them now (for the label's numbers). */
  cards: readonly Pick<CardData, "id" | "kind" | "rows" | "mapped" | "frameId" | "subject" | "links">[];
  conceptColors: Readonly<Record<Uuid, string>>;
  selectedId: Uuid | null;
  editable: boolean;
  /** A frame being drawn with the Frame tool. */
  drawing: Rect | null;
  onPointerDown: (e: ReactPointerEvent, frameId: Uuid, part: FramePart) => void;
}

function FrameLayer({ frames, cards, conceptColors, selectedId, editable, drawing, onPointerDown }: Props) {
  const detailed = useStore((s) => s.transform[2] >= LOD_ZOOM);
  const color = (id: Uuid) => conceptColors[id];
  return (
    <EdgeLabelRenderer>
      <div
        className="frame-layer"
        data-testid="layer-frames"
        onPointerDown={(e) => {
          const el = e.target as HTMLElement;
          const frameId = el.closest<HTMLElement>("[data-frame]")?.dataset.frame;
          if (!frameId) return;
          const part: FramePart = el.closest("[data-frame-handle]") ? "handle" : el.closest(".f-lab") ? "label" : "body";
          onPointerDown(e, frameId, part);
        }}
      >
        {frames.map((f) => (
          <FrameBox key={f.id} frame={f} cards={cards} color={frameColor(f, color)} selected={f.id === selectedId} editable={editable} detailed={detailed} />
        ))}
        {drawing && (
          <div className="frame-draw" data-testid="frame-drawing" style={{ left: drawing.x, top: drawing.y, width: drawing.w, height: drawing.h }} />
        )}
      </div>
    </EdgeLabelRenderer>
  );
}

const KIND_CLASS = { concept: "concept", source_system: "source", free: "free" } as const;

const FrameBox = memo(function FrameBox({
  frame: f,
  cards,
  color,
  selected,
  editable,
  detailed,
}: {
  frame: FrameData;
  cards: Props["cards"];
  color: string;
  selected: boolean;
  editable: boolean;
  detailed: boolean;
}) {
  const chips = useMemo(() => (detailed ? frameChips(frameStats(f, cards), f.kind) : []), [detailed, f, cards]);
  const kindLabel = f.kind === "concept" ? " (concept)" : f.kind === "source_system" ? " (source system)" : "";
  return (
    <div
      className={`im-frame ${KIND_CLASS[f.kind]}${selected ? " sel" : ""}`}
      data-frame={f.id}
      data-testid="frame"
      data-kind={f.kind}
      data-selected={selected || undefined}
      style={{ left: f.x, top: f.y, width: f.width, height: f.height, "--fc": color, "--fw": f.width } as CSSProperties}
    >
      <div
        className="f-lab"
        data-testid="frame-label"
        title={`${f.name}${kindLabel}. Drag to move the frame with everything in it, click to select.`}
      >
        <span className="f-dot" />
        <span className="f-name" data-testid="frame-name">
          {f.name}
        </span>
        {chips.map((c) => (
          <span key={c.text} className={`f-chip${c.tone === "warn" ? " w" : c.tone === "misplaced" ? " m" : ""}`} title={c.title} data-testid="frame-chip">
            {c.text}
          </span>
        ))}
      </div>
      {editable && <div className="f-rs" data-frame-handle title="Drag to resize" data-testid="frame-resize" />}
    </div>
  );
});

export default memo(FrameLayer);
