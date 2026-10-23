"use client";

// All mapping and relationship lines in one <svg> (AD-24 rule 3), portalled into React Flow's edge-label layer:
// it sits in the viewport, so lines pan and zoom with the canvas, and paints below the cards (prototype #lines).
// Card positions come from React Flow's store; row positions from the card data (AD-24 rule 2, geometry.rowEnd).
// Each line re-renders only when its geometry or state changes (memo on a signature), as in the spike. Its geometry is
// computed again only when one of its cards moved or changed (slice 2a step 3b): a drag recomputes the lines of the
// dragged cards, not all of them, on every frame.
// Hover (slice 1b, C-10): the lines are not restyled and the others do not fade (restyling 340 lines, or one veil over
// them, made the hover too slow); the hovered lines are drawn again, emphasised, by `HoverLines` below. Slice 4p (trial
// A): `HoverLines` draws in the overlay above the cards (its own compositing layer, `OverlayLayer.tsx`), so a hover
// neither re-renders nor repaints this layer.
// Slice 2c (D-07): lines touching a collapsed frame come as bundles (`bundleLines`), drawn in the same layer: a group of
// one mapping as that mapping, two or more as one line with a count, relationships with “N relationship(s)”.
// Slice 4b-2 (items 8–11): the requirement cards' trace lines, dashed, in the same layer (one path and one end dot each,
// no dot below 40 %), from data (`traceGeom`); each redrawn only when its ends move. They fade with the other lines on a
// selection (the layer's `dimmed` class), never on a hover. Step 6 (item 21): under Focus a trace line with both ends lit
// is drawn again above the veil by `LitLines`, solid (step 8: dashed, they cost about 32 ms of raster per Focus switch at
// 30 %); the rest fade under it, dashed.

import { Fragment, memo, useContext, useState, type ReactNode } from "react";
import { EdgeLabelRenderer, useStore, useStoreApi, type InternalNode } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx, type Notation } from "./context";
import { blockNodeId, type BlockNodeT } from "./BlockNode";
import { cardRect, ieMarker, LOD_ZOOM, multText, relGeom, umlMarker, type Placed, type Pt, type Rect } from "./geometry";
import { bundleGeom, mapGeom, placedOf, traceGeom, type Bundle, type BundleEnd, type BundleGeom, type MapGeom, type TraceCardPlace } from "./line-geometry";
import { REQ_CARD, requirementCardHeight } from "./requirement-card-data";
import type { ReqNodeT } from "./RequirementCardNode";
import type { TraceData } from "./trace-data";
import { relatedLines, type CanvasLines, type MapLineData, type RelLineData, type Related, type Selection } from "./line-data";
import { useValue, type ValueStore } from "./value-store";

interface LineProps {
  sig: string;
  className: string;
  onSelect: () => void;
}

/** The tag outline (16 × 16 icon, scaled to 0.62) at its place on the line: absolute points, so no transform per tag. */
const TAG = [[8.5, 2.5], [13.5, 2.5], [13.5, 7.5], [7.5, 13.5], [2.5, 8.5]] as const;
const tagPath = (x: number, y: number) =>
  `${TAG.map(([px, py], i) => `${i ? "L" : "M"}${+(x - 5 + px * 0.62).toFixed(2)} ${+(y - 5 + py * 0.62).toFixed(2)}`).join("")}Z`;

/**
 * The tag of a labeled mapping (prototype lineTag): drawn with the line, left out below 40 % zoom like the end dots. Two
 * elements and no group (slice 3a, S3A-14: every element in the viewport costs paint and layerize time on each pan and
 * zoom frame).
 */
const LineTag = ({ x, y }: { x: number; y: number }) => (
  <>
    <circle className="ltag" cx={x} cy={y} r={7} data-testid="mark-label-line" />
    <path className="ltag" d={tagPath(x, y)} />
  </>
);

const MapPath = memo(
  function MapPath({ id, geom, dots, labels, className, onSelect }: LineProps & { id: string; geom: MapGeom; dots: boolean; labels: string | null }) {
    return (
      <g className={className} data-testid="line-mapping" data-mapping={id} data-labels={labels ?? undefined} onClick={onSelect}>
        {labels && <title>{`Labels: ${labels}`}</title>}
        {geom.paths.map((d, i) => (
          <path key={`h${i}`} className="hit" d={d} />
        ))}
        {geom.paths.map((d, i) => (
          // a segment from a column missing from source: a class on the existing path (slice 7a, AD-24)
          <path key={`s${i}`} className={geom.gone?.[i] ? "s gone" : "s"} d={d} />
        ))}
        {dots && geom.dots.map(([x, y], i) => <circle key={`e${i}`} className="end" cx={x} cy={y} r={2.6} />)}
        {geom.chip && (
          <g className="chip" data-testid={geom.chip.text === "ƒ" ? "node-f" : "chip-warn"}>
            <circle cx={geom.chip.x} cy={geom.chip.y} r={8} />
            <text x={geom.chip.x} y={geom.chip.y}>
              {geom.chip.text}
            </text>
          </g>
        )}
        {labels && dots && <LineTag x={geom.tag.x} y={geom.tag.y} />}
      </g>
    );
  },
  (a, b) => a.sig === b.sig,
);

const RelPath = memo(
  function RelPath({ line, a, z, notation, className, onSelect }: LineProps & { line: RelLineData; a: Placed; z: Placed; notation: Notation }) {
    const g = relGeom(cardRect(a), cardRect(z), line.offset);
    let marks: React.ReactNode;
    if (notation === "ie") {
      const ma = ieMarker(g.pa, g.na, line.fromMin, line.fromMax), mb = ieMarker(g.pb, g.nb, line.toMin, line.toMax);
      marks = (
        <g data-testid="ends-ie">
          <path className="mk" d={ma.d + mb.d} />
          {ma.circle && <circle className="mk" cx={ma.circle.x} cy={ma.circle.y} r={4} />}
          {mb.circle && <circle className="mk" cx={mb.circle.x} cy={mb.circle.y} r={4} />}
        </g>
      );
    } else {
      const ma = umlMarker(g.pa, g.na), mb = umlMarker(g.pb, g.nb);
      marks = (
        <g data-testid="ends-uml">
          <text className="mult" x={ma.x} y={ma.y}>
            {multText(line.fromMin, line.fromMax)}
          </text>
          <text className="mult" x={mb.x} y={mb.y}>
            {multText(line.toMin, line.toMax)}
          </text>
        </g>
      );
    }
    const lw = line.label ? line.label.length * 6.1 + 14 : 0;
    return (
      <g className={className} data-testid="line-relationship" data-relationship={line.id} onClick={onSelect}>
        <path className="hit" d={g.d} />
        <path className="s" d={g.d} />
        {marks}
        {line.label && (
          <g className="rlab">
            <rect x={g.mid.x - lw / 2} y={g.mid.y - 9} width={lw} height={18} rx={9} />
            <text x={g.mid.x} y={g.mid.y}>
              {line.label}
            </text>
          </g>
        )}
      </g>
    );
  },
  (a, b) => a.sig === b.sig,
);

/** A bundle of two or more mappings, or of relationships (slice 2c, prototype .lnk.bundle). */
const BundlePath = memo(
  function BundlePath({ bundleKey, geom, className, onSelect }: LineProps & { bundleKey: string; geom: Exclude<BundleGeom, { kind: "single" }> }) {
    const lw = geom.kind === "rel" ? geom.label.length * 6.1 + 14 : 0;
    const r = geom.kind === "map" && geom.count > 9 ? 10 : 8.5;
    return (
      <g className={className} data-testid="line-bundle" data-bundle={bundleKey} data-count={geom.kind === "map" ? geom.count : undefined} onClick={onSelect}>
        <path className="hit" d={geom.d} />
        <path className="s" d={geom.d} style={{ strokeWidth: `${geom.width.toFixed(2)}px` }} />
        {geom.kind === "map" ? (
          <g className="chip" data-testid="chip-count">
            <circle cx={geom.mid.x} cy={geom.mid.y} r={r} />
            <text x={geom.mid.x} y={geom.mid.y}>
              {geom.count}
            </text>
          </g>
        ) : (
          <g className="rlab">
            <rect x={geom.mid.x - lw / 2} y={geom.mid.y - 9} width={lw} height={18} rx={9} />
            <text x={geom.mid.x} y={geom.mid.y}>
              {geom.label}
            </text>
          </g>
        )}
      </g>
    );
  },
  (a, b) => a.sig === b.sig,
);

/** A number per object, to tell a changed card (a new object) from the same one. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
const objectId = (o: object) => {
  let id = objectIds.get(o);
  if (id === undefined) objectIds.set(o, (id = nextObjectId++));
  return id;
};

/** Position, size and the card state that moves rows: what a relationship line depends on. */
const placedSig = (p: Placed) => `${p.x},${p.y},${p.card.width ?? ""},${p.card.collapsed ? 1 : 0},${p.card.rowFilter}`;

const NO_BUNDLES: Bundle[] = [];
const NO_BLOCKS = new Map<string, Rect>();
const NO_MAPS = new Map<string, MapLineData>();
const NO_TETHERS: readonly { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
const NO_TRACES: readonly TraceData[] = [];

/** A trace line (slice 4b-2): a dashed path and, at 40 % and above, its end dot; two elements, no group (S3A-14). */
const TracePath = memo(
  function TracePath({ id, x1, y1, x2, y2, dot, lit }: { sig: string; id: string; x1: number; y1: number; x2: number; y2: number; dot: boolean; lit?: boolean }) {
    return (
      <>
        <path className="trace" d={`M${x1},${y1} L${x2},${y2}`} data-testid={lit ? "lit-trace" : "line-trace"} data-trace={id} />
        {dot && <circle className="trace-dot" cx={x2} cy={y2} r={2.6} />}
      </>
    );
  },
  (a, b) => a.sig === b.sig,
);

/**
 * Where the trace lines run (slice 4b-2, items 8–9), from data (`traceGeom`): from the requirement card's edge to the
 * element's card, row or mapping middle; into a collapsed frame, its member row in the block; a mapping in a bundle at
 * the bundle line's middle; one hidden whole in a collapsed frame at its attribute's block row. A line without both ends
 * is left out. Shared by the line layer and Focus's lit copy above the veil (step 6).
 */
function traceSegments(
  traces: readonly TraceData[],
  lookup: Map<string, InternalNode>,
  lines: CanvasLines,
  bundles: readonly Bundle[],
  blocks: ReadonlyMap<string, Rect>,
  mapsById: ReadonlyMap<string, MapLineData>,
): { id: string; x1: number; y1: number; x2: number; y2: number }[] {
  if (!traces.length) return [];
  const placed = (cardId: string) => placedOf(lookup.get(cardId));
  const bundleOf = new Map<string, Bundle>();
  for (const b of bundles) if (b.t === "map") for (const id of b.ids) bundleOf.set(id, b);
  const shown = new Map(lines.mappings.map((l) => [l.id, l]));
  const reqRect = (id: string): Rect | null => {
    const n = lookup.get(id);
    if (!n) return null;
    const card = (n as unknown as ReqNodeT).data.card;
    return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: REQ_CARD.width, h: requirementCardHeight(card.nameLines) };
  };
  // a card hidden in a collapsed frame: its block, and its place among the block's members (item 9)
  const placeOf = (cardId: string): TraceCardPlace => {
    const n = lookup.get(cardId);
    if (!n) return null;
    if (!n.hidden) return { placed: placedOf(n)! };
    const frameId = (n as unknown as CardNodeT).data.card.frameId;
    const rect = frameId ? blocks.get(frameId) : undefined;
    const block = frameId ? (lookup.get(blockNodeId(frameId)) as unknown as BlockNodeT | undefined) : undefined;
    if (!rect || !block) return null;
    return { block: rect, index: Math.max(0, block.data.members.findIndex((m) => m.id === cardId)) };
  };
  // a mapping's middle: its line, or the bundle line that carries it at a collapsed frame
  const mapMid = (id: string): Pt | null => {
    const b = bundleOf.get(id);
    if (b) {
      const g = bundleGeom(b, placed, blocks, mapsById);
      return g ? (g.kind === "single" ? g.geom.mid : g.kind === "map" ? g.mid : null) : null;
    }
    const l = shown.get(id);
    return l ? (mapGeom(l, lookup)?.mid ?? null) : null;
  };
  const out: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  const r = (v: number) => +v.toFixed(1);
  for (const t of traces) {
    let g = traceGeom(reqRect(t.reqCardId), t.target, placeOf, mapMid);
    // a mapping not drawn on its own (both ends in one collapsed frame): its attribute's row in the block
    if (!g && t.target.t === "map") {
      const l = mapsById.get(t.target.mappingId);
      if (l) g = traceGeom(reqRect(t.reqCardId), { t: "row", cardId: l.cardId, rowId: l.attributeId }, placeOf, mapMid);
    }
    if (g) out.push({ id: t.id, x1: r(g.x1), y1: r(g.y1), x2: r(g.x2), y2: r(g.y2) });
  }
  return out;
}

function LineLayer({
  lines,
  bundles = NO_BUNDLES,
  blocks = NO_BLOCKS,
  mapsById = NO_MAPS,
  selection,
  related,
  onSelect,
  tethers = NO_TETHERS,
  traces = NO_TRACES,
}: {
  /** The lines drawn on their own: those touching no collapsed frame. */
  lines: CanvasLines;
  /** The lines touching a collapsed frame, grouped (slice 2c). */
  bundles?: readonly Bundle[];
  /** The block of each collapsed frame. */
  blocks?: ReadonlyMap<string, Rect>;
  /** Every mapping line of the canvas, bundled or not (a group of one is drawn as its mapping). */
  mapsById?: ReadonlyMap<string, MapLineData>;
  selection: Selection;
  related: Related | null;
  onSelect: (sel: Selection) => void;
  /** The dashed tethers of pinned notes (slice 3a, D-20), drawn here as part of the one line layer (AD-24 rule 3). */
  tethers?: readonly { id: string; x1: number; y1: number; x2: number; y2: number }[];
  /** The requirement cards' trace lines (slice 4b-2); empty outside “Everything” (item 10). */
  traces?: readonly TraceData[];
}) {
  // Re-render on any node change (drag, collapse, filter); panning and zooming leave the nodes alone.
  useStore((s) => s.nodes);
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const { notation } = useContext(CanvasUiCtx);
  const lookup = useStoreApi().getState().nodeLookup;
  const dots = !lod;
  /** Each line's element and what it was drawn from; reused while nothing it depends on changed. A cache, not state. */
  const [drawn] = useState(() => new Map<string, { key: string; el: ReactNode }>());
  /** A card's position and data, as one string; "-" when it is not on the canvas or hidden. */
  const cardKeys = new Map<string, string>();
  const cardKey = (id: string) => {
    let k = cardKeys.get(id);
    if (k === undefined) {
      const n = lookup.get(id);
      k = n && !n.hidden ? `${n.internals.positionAbsolute.x},${n.internals.positionAbsolute.y}#${objectId((n as unknown as CardNodeT).data.card)}` : "-";
      cardKeys.set(id, k);
    }
    return k;
  };
  /** The line's element from last time when its key is the same, else a new one. */
  const reuse = (id: string, key: string, make: () => ReactNode): ReactNode => {
    const last = drawn.get(id);
    if (last?.key === key) return last.el;
    const el = make();
    drawn.set(id, { key, el });
    return el;
  };
  const state = (kind: "map" | "rel", id: string) => {
    const sel = selection?.t === kind && selection.id === id ? " sel" : "";
    const hl = related && (kind === "map" ? related.maps : related.rels).has(id) ? " hl" : "";
    return sel + hl;
  };

  const rels: ReactNode[] = [];
  for (const l of lines.relationships) {
    const key = `${cardKey(l.fromCardId)}|${cardKey(l.toCardId)}|${notation}|${state("rel", l.id)}|${objectId(l)}`;
    const el = reuse(`rel:${l.id}`, key, () => {
      const a = placedOf(lookup.get(l.fromCardId)), z = placedOf(lookup.get(l.toCardId));
      if (!a || !z) return null;
      const className = `lnk rel${state("rel", l.id)}`;
      return (
        <RelPath
          key={l.id}
          sig={`${placedSig(a)}|${placedSig(z)}|${notation}|${className}|${l.label}|${l.fromMin}${l.fromMax}${l.toMin}${l.toMax}`}
          line={l}
          a={a}
          z={z}
          notation={notation}
          className={className}
          onSelect={() => onSelect({ t: "rel", id: l.id })}
        />
      );
    });
    if (el) rels.push(el);
  }
  const maps: ReactNode[] = [];
  for (const l of lines.mappings) {
    const key = `${cardKey(l.cardId)}|${l.inputs.map((i) => cardKey(i.cardId)).join(",")}|${dots}|${state("map", l.id)}|${objectId(l)}`;
    const el = reuse(`map:${l.id}`, key, () => {
      const geom = mapGeom(l, lookup);
      if (!geom) return null;
      const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.part ? " part" : ""}${l.inputCount > 1 ? " combined" : ""}${l.faded ? " ctxline" : ""}${state("map", l.id)}`;
      return (
        <MapPath
          key={l.id}
          sig={`${geom.paths.join("")}|${geom.gone?.join() ?? ""}|${dots}|${className}|${geom.chip?.text ?? ""}|${l.labels ?? ""}`}
          id={l.id}
          geom={geom}
          dots={dots}
          labels={l.labels}
          className={className}
          onSelect={() => onSelect({ t: "map", id: l.id })}
        />
      );
    });
    if (el) maps.push(el);
  }

  // ---- bundles (slice 2c) ----
  const placed = (cardId: string) => placedOf(lookup.get(cardId));
  const endKey = (e: BundleEnd) => {
    if ("frameId" in e) {
      const r = blocks.get(e.frameId);
      return r ? `${r.x},${r.y},${r.h}` : "-";
    }
    return cardKey(e.cardId);
  };
  const bundleState = (b: Bundle) => {
    const sel = selection?.t === "bundle" && selection.id === b.key ? " sel" : "";
    const hl = related && b.ids.some((id) => (b.t === "map" ? related.maps : related.rels).has(id)) ? " hl" : "";
    return sel + hl;
  };
  const bundled: ReactNode[] = [];
  for (const b of bundles) {
    const objs = b.ids.map((id) => (b.t === "map" && mapsById.get(id) ? objectId(mapsById.get(id)!) : 0)).join(",");
    const st = b.t === "map" && b.ids.length === 1 ? state("map", b.ids[0]!) : bundleState(b);
    const key = `${b.ids.join(",")}|${objs}|${endKey(b.a)}|${endKey(b.z)}|${dots}|${st}`;
    const el = reuse(`bundle:${b.key}`, key, () => {
      const geom = bundleGeom(b, placed, blocks, mapsById);
      if (!geom) return null;
      if (geom.kind === "single") {
        const l = geom.line;
        const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.geom.part ? " part" : ""}${l.faded ? " ctxline" : ""}${st}`;
        return (
          <MapPath
            key={b.key}
            sig={`${geom.geom.paths.join("")}|${geom.geom.gone?.join() ?? ""}|${dots}|${className}|${geom.geom.chip?.text ?? ""}|${l.labels ?? ""}`}
            id={l.id}
            geom={geom.geom}
            dots={dots}
            labels={l.labels}
            className={className}
            onSelect={() => onSelect({ t: "map", id: l.id })}
          />
        );
      }
      const className = geom.kind === "rel" ? `lnk rel bundle${st}` : `lnk map bundle${geom.draft ? " draft" : ""}${geom.warn ? " warn" : ""}${st}`;
      return (
        <BundlePath
          key={b.key}
          sig={`${geom.d}|${className}|${geom.kind === "map" ? geom.count : geom.label}|${geom.width}`}
          bundleKey={b.key}
          geom={geom}
          className={className}
          onSelect={() => onSelect({ t: "bundle", id: b.key })}
        />
      );
    });
    if (el) bundled.push(el);
  }

  // ---- trace lines (slice 4b-2, items 8–9) ----
  const traced = traceSegments(traces, lookup, lines, bundles, blocks, mapsById).map((g) => (
    <TracePath key={g.id} sig={`${g.x1},${g.y1},${g.x2},${g.y2},${dots}`} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} dot={dots} />
  ));

  return (
    <EdgeLabelRenderer>
      <svg className={`line-layer${related ? " dimmed" : ""}`} width={1} height={1} data-testid="layer-lines">
        <g>{rels}</g>
        <g>{maps}</g>
        <g>{bundled}</g>
        <g>{traced}</g>
        <g>
          {tethers.map((t) => (
            // no group per tether: two elements (slice 3a, S3A-14)
            <Fragment key={t.id}>
              <path className="tether" d={`M${t.x1},${t.y1} L${t.x2},${t.y2}`} data-testid="tether" data-tether={t.id} />
              <circle className="tether" cx={t.x2} cy={t.y2} r={2.5} />
            </Fragment>
          ))}
        </g>
      </svg>
    </EdgeLabelRenderer>
  );
}

export default memo(LineLayer);

const NOOP = () => {};

/**
 * The hovered row's or line's lines drawn again, a little stronger (slice 1b, C-10), in the overlay above the cards
 * (slice 4p, trial A). The hover and the lasso come from stores, so only this re-renders on a hover.
 */
export const HoverLines = memo(function HoverLines({
  hoverStore,
  lassoStore,
  busy,
  allLines,
  lines,
  bundles = NO_BUNDLES,
  blocks = NO_BLOCKS,
  mapsById = NO_MAPS,
}: {
  hoverStore: ValueStore<Selection>;
  lassoStore: ValueStore<Rect | null>;
  busy: boolean;
  /** Every line of the canvas: what the hovered row or line emphasises. */
  allLines: CanvasLines;
  /** The lines drawn on their own, and the bundles, as the line layer has them. */
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}) {
  const hovered = useValue(hoverStore);
  const lassoing = useValue(lassoStore) !== null;
  useStore((s) => s.nodes); // follow drags, collapses and widths
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const lookup = useStoreApi().getState().nodeLookup;
  const hover = busy || lassoing ? null : relatedLines(hovered, allLines);
  if (!hover) return null;
  const dots = !lod;
  const placed = (cardId: string) => placedOf(lookup.get(cardId));
  return (
    <svg className="line-layer hover-lines" width={1} height={1} data-testid="layer-hover-lines">
      {lines.mappings
        .filter((l) => hover.maps.has(l.id))
        .map((l) => {
          const geom = mapGeom(l, lookup);
          if (!geom) return null;
          const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${l.inputCount > 1 ? " combined" : ""} hl`;
          return <MapPath key={l.id} sig="" id={l.id} geom={geom} dots={dots} labels={l.labels} className={className} onSelect={NOOP} />;
        })}
      {bundles
        .filter((b) => b.t === "map" && b.ids.some((id) => hover.maps.has(id)))
        .map((b) => {
          const geom = bundleGeom(b, placed, blocks, mapsById);
          if (!geom || geom.kind === "rel") return null;
          if (geom.kind === "single") {
            const l = geom.line;
            return <MapPath key={b.key} sig="" id={l.id} geom={geom.geom} dots={dots} labels={l.labels} className={`lnk map ${l.status}${l.warn ? " warn" : ""} hl`} onSelect={NOOP} />;
          }
          const className = `lnk map bundle${geom.draft ? " draft" : ""}${geom.warn ? " warn" : ""} hl`;
          return <BundlePath key={b.key} sig="" bundleKey={b.key} geom={geom} className={className} onSelect={NOOP} />;
        })}
    </svg>
  );
});

/**
 * The lit lines drawn again in the overlay above the fading (slice 4p, step 2): the mappings and relationships a Focus or
 * a lens lights, and the bundles holding one of them, at their usual strength; the line layer under the fading stays as
 * it is.
 */
export const LitLines = memo(function LitLines({
  maps,
  rels,
  lines,
  bundles = NO_BUNDLES,
  blocks = NO_BLOCKS,
  mapsById = NO_MAPS,
  traces = NO_TRACES,
  testId = "layer-lit-lines",
}: {
  maps: ReadonlySet<string>;
  rels: ReadonlySet<string>;
  /** Focus's lit trace lines (slice 4b-2, PRD item 21: both ends lit). */
  traces?: readonly TraceData[];
  /** Focus's lit lines, or a selected requirement's (slice 4b-1, coverage colours). */
  testId?: string;
  /** The lines drawn on their own, and the bundles, as the line layer has them. */
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}) {
  useStore((s) => s.nodes); // follow drags, collapses and widths
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const { notation } = useContext(CanvasUiCtx);
  const lookup = useStoreApi().getState().nodeLookup;
  const dots = !lod;
  const placed = (cardId: string) => placedOf(lookup.get(cardId));
  return (
    <svg className="line-layer lit-lines" width={1} height={1} data-testid={testId}>
      {lines.relationships
        .filter((l) => rels.has(l.id))
        .map((l) => {
          const a = placed(l.fromCardId), z = placed(l.toCardId);
          if (!a || !z) return null;
          // a signature as in the line layer, so a lit line follows a drag (slice 4b-2, step 6: it kept its old place)
          return <RelPath key={l.id} sig={`${placedSig(a)}|${placedSig(z)}|${notation}|${l.label}|${l.fromMin}${l.fromMax}${l.toMin}${l.toMax}`} line={l} a={a} z={z} notation={notation} className="lnk rel" onSelect={NOOP} />;
        })}
      {lines.mappings
        .filter((l) => maps.has(l.id))
        .map((l) => {
          const geom = mapGeom(l, lookup);
          if (!geom) return null;
          const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.part ? " part" : ""}${l.inputCount > 1 ? " combined" : ""}`;
          return <MapPath key={l.id} sig={`${geom.paths.join("")}|${geom.gone?.join() ?? ""}|${dots}|${className}|${geom.chip?.text ?? ""}|${l.labels ?? ""}`} id={l.id} geom={geom} dots={dots} labels={l.labels} className={className} onSelect={NOOP} />;
        })}
      {bundles
        .filter((b) => b.ids.some((id) => (b.t === "map" ? maps : rels).has(id)))
        .map((b) => {
          const geom = bundleGeom(b, placed, blocks, mapsById);
          if (!geom) return null;
          if (geom.kind === "single") {
            const l = geom.line;
            const className = `lnk map ${l.status}${l.warn ? " warn" : ""}`;
            return <MapPath key={b.key} sig={`${geom.geom.paths.join("")}|${geom.geom.gone?.join() ?? ""}|${dots}|${className}|${geom.geom.chip?.text ?? ""}|${l.labels ?? ""}`} id={l.id} geom={geom.geom} dots={dots} labels={l.labels} className={className} onSelect={NOOP} />;
          }
          const className = geom.kind === "rel" ? "lnk rel bundle" : `lnk map bundle${geom.draft ? " draft" : ""}${geom.warn ? " warn" : ""}`;
          return <BundlePath key={b.key} sig={`${geom.d}|${className}|${geom.kind === "map" ? geom.count : geom.label}|${geom.width}`} bundleKey={b.key} geom={geom} className={className} onSelect={NOOP} />;
        })}
      {traceSegments(traces, lookup, lines, bundles, blocks, mapsById).map((g) => (
        <TracePath key={g.id} sig={`${g.x1},${g.y1},${g.x2},${g.y2},${dots}`} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} dot={dots} lit />
      ))}
    </svg>
  );
});
