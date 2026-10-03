"use client";

// All mapping and relationship lines in one <svg> (AD-24 rule 3), portalled into React Flow's edge-label layer:
// it sits in the viewport, so lines pan and zoom with the canvas, and paints below the cards (prototype #lines).
// Card positions come from React Flow's store; row positions from the card data (AD-24 rule 2, geometry.rowEnd).
// Each line re-renders only when its geometry or state changes (memo on a signature), as in the spike.

import { memo, useContext } from "react";
import { EdgeLabelRenderer, useStore, useStoreApi, type InternalNode } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { CanvasUiCtx, type Notation } from "./context";
import { cardRect, curve, fNode, ieMarker, LOD_ZOOM, multText, relGeom, rowEnd, umlMarker, type End, type Placed } from "./geometry";
import type { CanvasLines, MapLineData, RelLineData, Related, Selection } from "./line-data";

const placedOf = (n: InternalNode | undefined): Placed | null =>
  n && !n.hidden ? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, card: (n as unknown as CardNodeT).data.card } : null;

interface MapGeom {
  /** Input curves (to the attribute, or to the ƒ node of a combined mapping) and the ƒ node's line on. */
  paths: string[];
  dots: [number, number][];
  chip: { x: number; y: number; text: string } | null;
  part: boolean;
}

function mapGeom(line: MapLineData, lookup: Map<string, InternalNode>): MapGeom | null {
  const target = placedOf(lookup.get(line.cardId));
  if (!target) return null;
  const attr = rowEnd(target, line.attributeId);
  const inputs: End[] = [];
  for (const i of line.inputs) {
    const p = placedOf(lookup.get(i.cardId));
    if (p) inputs.push(rowEnd(p, i.columnId));
  }
  if (!inputs.length) return null;
  const part = attr.hidden || inputs.some((e) => e.hidden);
  if (line.inputCount > 1) {
    const f = fNode(attr, inputs);
    const curves = inputs.map((e) => curve(e, f.end));
    return {
      paths: [...curves.map((c) => c.d), f.out],
      dots: [...curves.map((c) => [c.p0.x, c.p0.y] as [number, number]), [f.to.x, f.to.y]],
      chip: { x: f.node.x, y: f.node.y, text: "ƒ" },
      part,
    };
  }
  const g = curve(inputs[0]!, attr);
  const text = line.warn ? "!" : line.ruled ? "ƒ" : "";
  return {
    paths: [g.d],
    dots: [
      [g.p0.x, g.p0.y],
      [g.p3.x, g.p3.y],
    ],
    chip: text ? { x: g.mid.x, y: g.mid.y, text } : null,
    part,
  };
}

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

/** Position, size and the card state that moves rows: what a relationship line depends on. */
const placedSig = (p: Placed) => `${p.x},${p.y},${p.card.width ?? ""},${p.card.collapsed ? 1 : 0},${p.card.rowFilter}`;

function LineLayer({
  lines,
  selection,
  related,
  onSelect,
}: {
  lines: CanvasLines;
  selection: Selection;
  related: Related | null;
  onSelect: (sel: Selection) => void;
}) {
  // Re-render on any node change (drag, collapse, filter); panning and zooming leave the nodes alone.
  useStore((s) => s.nodes);
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const { notation } = useContext(CanvasUiCtx);
  const lookup = useStoreApi().getState().nodeLookup;
  const dots = !lod;
  const state = (kind: "map" | "rel", id: string) => {
    const sel = selection?.t === kind && selection.id === id ? " sel" : "";
    const hl = related && (kind === "map" ? related.maps : related.rels).has(id) ? " hl" : "";
    return sel + hl;
  };

  const rels: React.ReactNode[] = [];
  for (const l of lines.relationships) {
    const a = placedOf(lookup.get(l.fromCardId)), z = placedOf(lookup.get(l.toCardId));
    if (!a || !z) continue;
    const className = `lnk rel${state("rel", l.id)}`;
    rels.push(
      <RelPath
        key={l.id}
        sig={`${placedSig(a)}|${placedSig(z)}|${notation}|${className}|${l.label}|${l.fromMin}${l.fromMax}${l.toMin}${l.toMax}`}
        line={l}
        a={a}
        z={z}
        notation={notation}
        className={className}
        onSelect={() => onSelect({ t: "rel", id: l.id })}
      />,
    );
  }
  const maps: React.ReactNode[] = [];
  for (const l of lines.mappings) {
    const geom = mapGeom(l, lookup);
    if (!geom) continue;
    const className = `lnk map ${l.status}${l.warn ? " warn" : ""}${geom.part ? " part" : ""}${l.inputCount > 1 ? " combined" : ""}${state("map", l.id)}`;
    maps.push(
      <MapPath
        key={l.id}
        sig={`${geom.paths.join("")}|${dots}|${className}|${geom.chip?.text ?? ""}`}
        id={l.id}
        geom={geom}
        dots={dots}
        className={className}
        onSelect={() => onSelect({ t: "map", id: l.id })}
      />,
    );
  }

  return (
    <EdgeLabelRenderer>
      <svg className={`line-layer${related ? " dimmed" : ""}`} width={1} height={1} data-testid="layer-lines">
        <g>{rels}</g>
        <g>{maps}</g>
      </svg>
    </EdgeLabelRenderer>
  );
}

export default memo(LineLayer);
