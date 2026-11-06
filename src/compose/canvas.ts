// The modules' objects on the canvas (slice 15c, C4, C7, C8): one per kind of a module's line, with the hook the canvas
// host calls (its drag, drop, menu, delete, a history place's text) and its panel. Apart from `src/compose/index.ts`,
// so the domain's and the store's callers never load client components.

import type { CanvasExtension } from "@/canvas/extensions";
import { CUBE_MAPPING_KIND } from "@/modules/infocube/canvas/lines";
import { useCubeCanvas } from "@/modules/infocube/app/canvas-ext";
import { CubeMappingPanel } from "@/modules/infocube/app/mapping-panel";

export const CANVAS_EXTENSIONS: readonly CanvasExtension[] = [{ kind: CUBE_MAPPING_KIND, useHandlers: useCubeCanvas, Panel: CubeMappingPanel }];
