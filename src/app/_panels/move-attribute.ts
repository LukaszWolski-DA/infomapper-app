"use client";

// Attribute order (slice 1b, D-36): one place up or down, to the top or bottom, or to a position (drag in the entity
// panel). Used by the keyboard on the canvas (Ctrl/Alt + ↑/↓), the toolbox, the attribute panel's “Position 3 of 8”
// and the entity panel's list. The order belongs to the model, so every canvas shows it; the moved row flashes.
// Slice 10a (F3): a move renumbers the entity's other attributes too, so it saves over all of them (`saveRows`): the
// moved attribute's version is sent, the others are held, and their saves started meanwhile wait for its answer.

import { useCallback, useContext } from "react";
import { reorderAttributeAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, type AttributeMove } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { targetPosition, type ModelIndex } from "./model-index";

export function useMoveAttribute(ix: ModelIndex, workspaceId: string) {
  const ui = useContext(CanvasUiCtx);
  const { saveRows } = useAction();
  return useCallback(
    async (attributeId: Uuid, how: AttributeMove | number) => {
      const a = ix.attribute.get(attributeId);
      if (!a) return;
      const list = ix.attributesOf.get(a.entity_id) ?? [];
      const position = targetPosition(list.findIndex((x) => x.id === a.id), list.length, how);
      if (position === null) return;
      const rows = [{ id: a.id, shown: a.version }, ...list.filter((x) => x.id !== a.id).map((x) => ({ id: x.id }))];
      const result = await saveRows(rows, (versionOf) => reorderAttributeAction(workspaceId, { attributeId: a.id, expectedVersion: versionOf(a.id), position }));
      if (result.ok) ui.flashRow(a.id);
    },
    [ix, workspaceId, saveRows, ui],
  );
}
