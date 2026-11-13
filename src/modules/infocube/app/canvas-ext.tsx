"use client";

// InfoCube's dimensional mappings on the canvas (slice 15c, B-6, C4, C7, C8; prototype `findDrop`, the line menu
// l. 3985–3990, the Delete key l. 5786): the drag from an entity's attribute row in either direction, onto a row or a
// header, with the module deciding each drop (`planDrop`) and its refusal's toast; the line's menu (the status for those
// who may set it, "Edit transformation rule…", "Delete mapping"); the Delete key; a history place's "That mapping no
// longer exists.". InfoMapper's canvas host calls this through the composition root (`src/compose/canvas.ts`) and
// draws the lines from `cubeLines`. Every write is a module command: the delete and the status on the save chain with
// the mapping's row checked, a header drop on the card's queue (it opens the card).

import { useCallback, useContext, useMemo, useState } from "react";
import { useModules } from "@/app/_components/modules";
import { useAction } from "@/app/_components/use-action";
import { useSidePanels } from "@/app/_components/side-panels";
import { CanvasUiCtx, type RowDropTarget } from "@/canvas/context";
import type { CanvasExtContext, CanvasExtHandlers, ExtMenuItem } from "@/canvas/extensions";
import type { Uuid } from "@/domain/ids";
import { useToast } from "@/ui/components/toast";
import { CUBE_MAPPING_KIND } from "../canvas/lines";
import { CUBE_MAPPING_GONE } from "../domain/checks";
import { MAPPING_EXISTS_SELECTED, mappingIndex, planDrop, type MappingIndex } from "../domain/mappings";
import type { CubeMapping, CubeMappingInput, CubeMappingStatus } from "../domain/types";
import type { CubePageRows } from "../domain/view";
import { createCubeMappingAction, createOnHeaderAction, deleteCubeMappingAction, setCubeMappingStatusAction, updateCubeMappingAction } from "./actions";
import { CreateDimensionDialog } from "./create-dimension-dialog";
import { ruleFocus } from "./rule-focus";

/** "That mapping no longer exists." (a history place, D-38; InfoMapper's mapping's text), the domain's. */
export { CUBE_MAPPING_GONE };
const STATUS_LABEL: Record<CubeMappingStatus, string> = { draft: "Draft", review: "In review", approved: "Approved" };
const STATUSES: CubeMappingStatus[] = ["draft", "review", "approved"];
const NO_ROWS: Pick<CubePageRows, "cubeMappings" | "cubeMappingInputs"> = { cubeMappings: [], cubeMappingInputs: [] };

/** The index of the page's model and InfoCube's mapping rows, once per data version. */
export function useMappingIndex(model: CanvasExtContext["model"]): MappingIndex {
  const rows = (useModules().data.infocube as CubePageRows | undefined) ?? NO_ROWS;
  return useMemo(
    () =>
      // the page's rows come without `created_*` (O8): the index orders by id then
      mappingIndex({
        entities: model.entities,
        attributes: model.attributes,
        cubeMappings: rows.cubeMappings as CubeMapping[],
        cubeMappingInputs: rows.cubeMappingInputs as CubeMappingInput[],
      }),
    [model.entities, model.attributes, rows],
  );
}

/** "Customer.segment_code + Order Line.quantity → Fact Sales.net_amount" (the menu's head, the panel's trace). */
export const traceOf = (index: MappingIndex, id: Uuid): string => {
  const m = index.mapping(id);
  return m ? `${index.inputsOf(id).map((i) => index.label(i.attribute_id)).join(" + ")} → ${index.label(m.attribute_id)}` : "";
};

/**
 * "Delete mapping", the Delete key: on the save chain with the mapping's row checked; once deleted, the ids the delete
 * removed (the answer's `deleted`, for `ui.deselectDeleted`), else undefined.
 */
export function useCubeMappingDelete(workspaceId: string, index: MappingIndex) {
  const { saveRow } = useAction();
  return useCallback(
    async (id: Uuid) => {
      const m = index.mapping(id);
      if (!m) return undefined;
      const r = await saveRow(m, (v) => deleteCubeMappingAction(workspaceId, { mappingId: m.id, expectedVersion: v }), "Mapping deleted", { undoable: true, deletes: true });
      return r.ok ? r.deleted : undefined;
    },
    [saveRow, index, workspaceId],
  );
}

export function useCubeCanvas(context: CanvasExtContext): CanvasExtHandlers {
  const { workspaceId, editable, canSetStatus, model, cards } = context;
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { run, saveRow } = useAction();
  const { openDetails } = useSidePanels();
  const index = useMappingIndex(model);
  const deleteMapping = useCubeMappingDelete(workspaceId, index);
  // "Create dimension from this…" (B-2): offered while InfoCube is on (its creates are there only then)
  const on = useModules().creates.length > 0;
  const [dimensionFrom, setDimensionFrom] = useState<Uuid | null>(null);
  const levelOfEntity = useMemo(() => new Map(model.entities.map((e) => [e.id, e.model_level])), [model.entities]);
  const cardOfEntity = useMemo(() => new Map(cards.filter((c) => c.kind === "ent").map((c) => [c.targetId, c.id])), [cards]);

  return useMemo(() => {
    const select = (id: Uuid) => ui.select({ t: "ext", kind: CUBE_MAPPING_KIND, id });
    /** The entities of the cards of one level on this canvas: what stays lit under the drag's veil. */
    const entitiesOf = (level: "logical" | "dimensional") => cards.filter((c) => c.kind === "ent" && levelOfEntity.get(c.targetId) === level).map((c) => c.targetId);
    const onto = (t: RowDropTarget) => ("attributeId" in t ? { attributeId: t.attributeId } : "entityId" in t ? { entityId: t.entityId } : { columnId: t.columnId });

    const remove = (id: Uuid) => {
      if (!editable) return;
      void deleteMapping(id).then((deleted) => ui.deselectDeleted(deleted));
    };

    const menu = (id: Uuid): ExtMenuItem[] => {
      const m = index.mapping(id);
      if (!m) return [];
      const items: ExtMenuItem[] = [{ head: traceOf(index, id) }];
      if (canSetStatus) {
        for (const status of STATUSES) {
          items.push({
            label: STATUS_LABEL[status],
            checked: m.status === status,
            act: () => void saveRow(m, (v) => setCubeMappingStatusAction(workspaceId, { mappingId: m.id, expectedVersion: v, status })),
          });
        }
      }
      if (editable) {
        items.push({ sep: true });
        // the prototype makes it a transformation and goes to the rule (P20: "It is a transformation now. Describe the rule.")
        items.push({
          label: "Edit transformation rule…",
          act: () => {
            openDetails();
            // the panel puts the cursor in the rule once it is a transformation
            ruleFocus.set(m.id);
            if (m.kind === "transform") return;
            void saveRow(m, (v) => updateCubeMappingAction(workspaceId, { mappingId: m.id, expectedVersion: v, kind: "transform" }), "It is a transformation now. Describe the rule.");
          },
        });
        items.push({ label: "Delete mapping", danger: true, kbd: "Del", act: () => remove(id) });
      }
      return items;
    };

    return {
      gone: (id) => (index.mapping(id) ? null : CUBE_MAPPING_GONE),
      menu,
      remove,
      cardMenu: (entityId) =>
        editable && on && levelOfEntity.get(entityId) === "logical" ? [{ label: "Create dimension from this…", act: () => setDimensionFrom(entityId), testId: "menu-create-dimension" }] : [],
      overlay: dimensionFrom ? <CreateDimensionDialog entityId={dimensionFrom} onClose={() => setDimensionFrom(null)} /> : null,
      rowDrag: (attributeId) => {
        const level = index.levelOf(attributeId);
        if (!level) return null;
        // the cards that can take it: the other level's (prototype `from-attr`, `from-dattr`)
        const lit = entitiesOf(level === "logical" ? "dimensional" : "logical");
        // a logical row drags only where a fact or a dimension is on the canvas; a dimensional one always
        if (level === "logical" && !lit.length) return null;
        return {
          lit: { entities: lit, tables: [] },
          plan: (target) => {
            const plan = planDrop(index, attributeId, onto(target));
            return plan.t === "none" ? "none" : plan.t === "refuse" ? { refuse: plan.message } : "ok";
          },
        };
      },
      drop: ({ attributeId, target }) => {
        if (!editable) return;
        const plan = planDrop(index, attributeId, onto(target));
        if (plan.t === "exists") {
          select(plan.mappingId);
          toast(MAPPING_EXISTS_SELECTED);
        } else if (plan.t === "refuse") toast(plan.message, "refusal");
        else if (plan.t === "map") {
          void run(() => createCubeMappingAction(workspaceId, { inputAttributeId: plan.inputId, targetAttributeId: plan.targetId }), (v) => v.toast, { undoable: true }).then((r) => {
            if (r.ok) select(r.value.mappingId);
          });
        } else if (plan.t === "header") {
          const cardId = cardOfEntity.get(plan.entityId);
          const send = (expectedVersion?: number) =>
            createOnHeaderAction(workspaceId, {
              inputAttributeId: plan.inputId,
              entityId: plan.entityId,
              ...(cardId && expectedVersion !== undefined ? { card: { canvasItemId: cardId, expectedVersion } } : {}),
            });
          // the card opens with the new row (the prototype): on the card's queue, with its version then
          const write = () => run(() => (cardId ? ui.withCard(cardId, (v) => send(v)) : send()), (v) => v.toast, { undoable: true });
          void write().then((r) => {
            if (r.ok && cardId) ui.select({ t: "row", cardId, id: r.value.attributeId });
          });
        }
      },
    };
  }, [index, cards, levelOfEntity, cardOfEntity, ui, toast, run, saveRow, editable, canSetStatus, workspaceId, openDetails, deleteMapping, on, dimensionFrom]);
}
