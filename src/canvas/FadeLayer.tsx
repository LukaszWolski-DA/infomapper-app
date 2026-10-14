"use client";

// The fading mechanism (slice 4p, step 2): each trial branch puts its candidate here (F1: a veil with the lit cards
// lifted above it; F4: a veil with holes on its own layer). Here, on the shared base, it draws nothing.

import type { CanvasLines, MapLineData } from "./line-data";
import type { Bundle } from "./line-geometry";
import type { Rect } from "./geometry";
import type { FadeData, FadeNote } from "./fade-canvas";

export interface FadeLayerProps {
  data: FadeData | undefined;
  notes: readonly FadeNote[];
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}

export default function FadeLayer(props: FadeLayerProps) {
  void props;
  return null;
}
