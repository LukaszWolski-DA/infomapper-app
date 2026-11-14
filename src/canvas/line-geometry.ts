// The canvas's side of the line geometry (slice 2p, item 4): the cards where React Flow has them now. The geometry itself
// moved to the domain in slice 27 (F1), so the documents' figures route lines by the same rules.

import type { InternalNode } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { mapGeom as mapGeomAt, moduleGeom as moduleGeomAt, type MapGeom, type ModuleGeom } from "@/domain/canvas/line-geometry";
import type { Placed } from "@/domain/canvas/geometry";
import type { MapLineData, ModuleLineData } from "@/domain/canvas/line-data";

export * from "@/domain/canvas/line-geometry";

export const placedOf = (n: InternalNode | undefined): Placed | null =>
  n && !n.hidden ? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, card: (n as unknown as CardNodeT).data.card } : null;

export const mapGeom = (line: MapLineData, lookup: Map<string, InternalNode>): MapGeom | null => mapGeomAt(line, (id) => placedOf(lookup.get(id)));
export const moduleGeom = (line: ModuleLineData, lookup: Map<string, InternalNode>): ModuleGeom | null => moduleGeomAt(line, (id) => placedOf(lookup.get(id)));
