"use client";

// All mapping and relationship lines in one <svg> (AD-24 rule 3), portalled into React Flow's edge-label layer:
// it sits in the viewport, so lines pan and zoom with the canvas, and paints below the cards (prototype #lines).
// Card positions come from React Flow's store; row positions from the card data (AD-24 rule 2, geometry.rowEnd).
// Each line re-renders only when its geometry or state changes (memo on a signature), as in the spike. Its geometry is
// computed again only when one of its cards moved or changed (slice 2a step 3b): a drag recomputes the lines of the
// dragged cards, not all of them, on every frame.
// Hover (slice 1b, C-10): the lines are not restyled and the others do not fade (restyling 340 lines, or one veil over
// them, made the hover too slow); the hovered lines are drawn again, emphasised, above the others and below the cards.
// Slice 2c (D-07): lines touching a collapsed frame come as bundles (`bundleLines`), drawn in the same layer: a group of
// one mapping as that mapping, two or more as one line with a count, relationships with “N relationship(s)”.

import { memo, useContext, useState, type ReactNode } from "react";
import { EdgeLabelRenderer, useStore, useStoreApi } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx, type Notation } from "./context";
import { cardRect, ieMarker, LOD_ZOOM, multText, relGeom, umlMarker, type Placed, type Rect } from "./geometry";
import { bundleGeom, mapGeom, placedOf, type Bundle, type BundleEnd, type BundleGeom, type MapGeom } from "./line-geometry";
import type { CanvasLines, MapLineData, RelLineData, Related, Selection } from "./line-data";

interface LineProps {
  sig: string;
  className: string;
  onSelect: () => void;
}

const MapPath = memo(
  function MapPath({ id, geom, dots, className, onSelect }: LineProps & { id: string; geom: MapGeom; dots: boolean }) {
    return (
      <g className={className} data-testid="line-mapping" data-mapping={id} onClick={onSelect}>
        {geom.paths.map((d, i) => (
          <path key={`h${i}`} className="hit" d={d} />
        ))}
        {geom.paths.map((d, i) => (
          <path key={`s${i}`} className="s" d={d} />
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

function LineLayer({
  lines,
  bundles = NO_BUNDLES,
  blocks = NO_BLOCKS,
  mapsById = NO_MAPS,
  selection,
  related,
  hover,
  onSelect,
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
  /** The lines of the hovered row or line, drawn above the veil; null when nothing is hovered. */
  hover: Related | null;
  onSelect: (sel: Selection) => void;
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
      const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.part ? " part" : ""}${l.inputCount > 1 ? " combined" : ""}${state("map", l.id)}`;
      return (
        <MapPath
          key={l.id}
          sig={`${geom.paths.join("")}|${dots}|${className}|${geom.chip?.text ?? ""}`}
          id={l.id}
          geom={geom}
          dots={dots}
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
        const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.geom.part ? " part" : ""}${st}`;
        return (
          <MapPath
            key={b.key}
            sig={`${geom.geom.paths.join("")}|${dots}|${className}|${geom.geom.chip?.text ?? ""}`}
            id={l.id}
            geom={geom.geom}
            dots={dots}
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

  return (
    <EdgeLabelRenderer>
      <svg className={`line-layer${related ? " dimmed" : ""}`} width={1} height={1} data-testid="layer-lines">
        <g>{rels}</g>
        <g>{maps}</g>
        <g>{bundled}</g>
      </svg>
      {hover && (
        <svg className="line-layer hover-lines" width={1} height={1} data-testid="layer-hover-lines">
          {lines.mappings
            .filter((l) => hover.maps.has(l.id))
            .map((l) => {
              const geom = mapGeom(l, lookup);
              if (!geom) return null;
              const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${l.inputCount > 1 ? " combined" : ""} hl`;
              return <MapPath key={l.id} sig="" id={l.id} geom={geom} dots={dots} className={className} onSelect={() => {}} />;
            })}
          {bundles
            .filter((b) => b.t === "map" && b.ids.some((id) => hover.maps.has(id)))
            .map((b) => {
              const geom = bundleGeom(b, placed, blocks, mapsById);
              if (!geom || geom.kind === "rel") return null;
              if (geom.kind === "single") {
                const l = geom.line;
                return <MapPath key={b.key} sig="" id={l.id} geom={geom.geom} dots={dots} className={`lnk map ${l.status}${l.warn ? " warn" : ""} hl`} onSelect={() => {}} />;
              }
              const className = `lnk map bundle${geom.draft ? " draft" : ""}${geom.warn ? " warn" : ""} hl`;
              return <BundlePath key={b.key} sig="" bundleKey={b.key} geom={geom} className={className} onSelect={() => {}} />;
            })}
        </svg>
      )}
    </EdgeLabelRenderer>
  );
}

export default memo(LineLayer);
