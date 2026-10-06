"use client";

// Attribute order (slice 1b, D-36): one place up or down, to the top or bottom, or to a position (drag in the entity
// panel). Used by the keyboard on the canvas (Ctrl/Alt + ↑/↓), the toolbox, the attribute panel's “Position 3 of 8”
// and the entity panel's list. The order belongs to the model, so every canvas shows it; the moved row flashes.

import { useCallback, useContext } from "react";
import { reorderAttributeAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, type AttributeMove } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { targetPosition, type ModelIndex } from "./model-index";

export function useMoveAttribute(ix: ModelIndex, workspaceId: string) {
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  return useCallback(
    async (attributeId: Uuid, how: AttributeMove | number) => {
      const a = ix.attribute.get(attributeId);
      if (!a) return;
      const list = ix.attributesOf.get(a.entity_id) ?? [];
      const position = targetPosition(list.findIndex((x) => x.id === a.id), list.length, how);
      if (position === null) return;
      const result = await run(() => reorderAttributeAction(workspaceId, { attributeId: a.id, expectedVersion: a.version, position }));
      if (result.ok) ui.flashRow(a.id);
    },
    [ix, workspaceId, run, ui],
  );
}
