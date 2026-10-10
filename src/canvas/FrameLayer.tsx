"use client";

// The frames of a canvas (slice 2b; prototype renderFrames, .frame, .f-lab, .f-rs). Frames are not React Flow nodes
// and not parents of cards: they are one layer inside the viewport, painted under the lines and the cards (z-index −1
// in the viewport's stacking context), in a fixed order that hover, drag, relate and selection never change. Smaller
// frames come later, so where frames overlap the smaller one is on top, as membership is (D-05).
// What counts as the frame: its name strip above it, its resize handle and its empty area. Everything on top of it
// (cards, lines) is hit first. Right drag, the middle button, Space + drag and the wheel reach React Flow's panning,
// because nothing here is marked `nopan`. The label keeps its size on the screen at every zoom (prototype --iz); below
// 40 % the chips are left out (AD-24 rule 1). Fills are a colour mixed in CSS, never `opacity` (AD-24 rule 4).

import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelRenderer, useStore, useStoreApi } from "@xyflow/react";
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
  /** Names and chips (off only in the measurement-only diagnosis `nolabels`). */
  labels?: boolean;
  /** Collapse a frame into one block (slice 2c): the label's button and a double-click on the name. */
  onCollapse?: (frameId: Uuid, collapsed: boolean) => void;
  onPointerDown: (e: ReactPointerEvent, frameId: Uuid, part: FramePart) => void;
}

function FrameLayer({ frames, cards, conceptColors, selectedId, editable, drawing, labels = true, onCollapse, onPointerDown }: Props) {
  const detailed = useStore((s) => s.transform[2] >= LOD_ZOOM);
  const color = (id: Uuid) => conceptColors[id];
  // --iz (1 / zoom) keeps the names and handles the same size on the screen. It is set on this layer, without a render,
  // when the zoom changes: on the canvas root it made every card restyle on each zoom step (S2B-14, slice 2b step 5).
  const storeApi = useStoreApi();
  const layer = useRef<HTMLDivElement | null>(null);
  const setLayer = useCallback(
    (el: HTMLDivElement | null) => {
      layer.current = el;
      el?.style.setProperty("--iz", String(1 / storeApi.getState().transform[2]));
    },
    [storeApi],
  );
  useEffect(() => {
    let last = storeApi.getState().transform[2];
    return storeApi.subscribe((s) => {
      const z = s.transform[2];
      if (z === last) return;
      last = z;
      layer.current?.style.setProperty("--iz", String(1 / z));
    });
  }, [storeApi]);
  return (
    <EdgeLabelRenderer>
      <div
        ref={setLayer}
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
        {/* a collapsed frame is drawn as a block, a node with the cards (BlockNode, slice 2c) */}
        {frames
          .filter((f) => !f.collapsed)
          .map((f) => (
            <FrameBox
              key={f.id}
              frame={f}
              cards={cards}
              color={frameColor(f, color)}
              selected={f.id === selectedId}
              editable={editable}
              detailed={detailed}
              labels={labels}
              onCollapse={onCollapse}
            />
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
  labels,
  onCollapse,
}: {
  frame: FrameData;
  cards: Props["cards"];
  color: string;
  selected: boolean;
  editable: boolean;
  detailed: boolean;
  labels: boolean;
  onCollapse?: (frameId: Uuid, collapsed: boolean) => void;
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
      {labels && (
        <div
          className="f-lab"
          data-testid="frame-label"
          title={`${f.name}${kindLabel}. Drag to move the frame with everything in it, click to select${onCollapse ? ", double-click to collapse" : ""}.`}
          onDoubleClick={(e) => {
            if (!onCollapse || (e.target as HTMLElement).closest("button")) return;
            onCollapse(f.id, true);
          }}
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
      )}
      {/* the collapse button sits just left of the label, outside it: a wider label made zooming at the overview cost
          about 20 ms of GPU work per frame in Chrome (S2C-12 diagnosis), so the label keeps its slice 2b width */}
      {labels && onCollapse && (
        <button
          type="button"
          className="ib f-collapse"
          title="Collapse into one block"
          data-testid="button-frame-collapse"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onCollapse(f.id, true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M2.5 2.5l4 4M6.5 3v3.5H3M13.5 13.5l-4-4M9.5 13v-3.5H13" />
          </svg>
        </button>
      )}
      {editable && <div className="f-rs" data-frame-handle title="Drag to resize" data-testid="frame-resize" />}
    </div>
  );
});

export default memo(FrameLayer);
