"use client";

// The right panel (prototype #ins): shows and edits what is selected on the canvas: an entity, attribute, mapping,
// relationship, source table or column; with nothing selected, an overview of this canvas.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceModel } from "@/domain/types";
import { AttributePanel } from "./attribute-panel";
import { EntityPanel } from "./entity-panel";
import { useCanvasHost, type HostCard } from "./canvas-host";
import type { PendingInput } from "./map-column";
import { MappingPanel } from "./mapping-panel";
import { indexModel, type ModelIndex } from "./model-index";
import { OverviewPanel } from "./overview-panel";
import { RelationshipPanel } from "./relationship-panel";
import { SourceColumnPanel, SourceTablePanel } from "./source-panels";
import type { TreeData } from "./tree-data";

export interface InspectorProps {
  workspaceId: string;
  canvasId: string;
  canvasName: string;
  /** Canvases of the workspace (“The model is shared by n canvases”). */
  canvasCount: number;
  /** The live model of the workspace. */
  model: WorkspaceModel;
  /** The cards of this canvas: card id, what it shows, collapsed and row filter (for the toolbox). */
  cards: HostCard[];
  tree: TreeData;
  /** Owner, admin or modeler, not archived. */
  editable: boolean;
  /** May set a mapping's status (also reviewers). */
  canSetStatus: boolean;
  userId: Uuid;
  fourEyes: boolean;
  /** Who last changed each mapping's inputs, kind or rule (AD-06); only filled when four-eyes is on. */
  contentAuthors: Record<Uuid, Uuid>;
}

export interface PanelContext extends Omit<InspectorProps, "model" | "cards" | "tree"> {
  ix: ModelIndex;
  /** The card of an entity or source table on this canvas. */
  cardOf: (targetId: Uuid) => Uuid | null;
  /** Elements on another canvas but not here (rings in the left panel). */
  elsewhere: (targetId: Uuid) => boolean;
  tablesHere: ReadonlySet<Uuid>;
  goEntity: (entityId: Uuid) => void;
  goAttribute: (attributeId: Uuid) => void;
  goMapping: (mappingId: Uuid) => void;
  /** Selects a column row when its table is on this canvas. */
  goColumn: (columnId: Uuid) => void;
  entitiesHere: ReadonlySet<Uuid>;
  /** Maps a column to an attribute (D-48): directly, or after the choice shown at `at` (screen coordinates). */
  mapColumn: (columnId: Uuid, attributeId: Uuid, at: { x: number; y: number }) => void;
  /** A column chosen with “Add to mapping …”, waiting in the mapping panel for its rule. */
  pendingInput: PendingInput | null;
  clearPendingInput: () => void;
}

const Ctx = createContext<PanelContext | null>(null);
export const usePanel = () => useContext(Ctx)!;

export function Inspector({ model, cards, tree, ...rest }: InspectorProps) {
  const ui = useContext(CanvasUiCtx);
  const ix = useMemo(() => indexModel(model), [model]);
  const cardOf = useMemo(() => {
    const cardByTarget = new Map(cards.map((c) => [c.targetId, c.id]));
    return (id: Uuid) => cardByTarget.get(id) ?? null;
  }, [cards]);
  const host = useCanvasHost({ ix, workspaceId: rest.workspaceId, canvasId: rest.canvasId, editable: rest.editable, canSetStatus: rest.canSetStatus, cards });
  const { mapColumn, pendingInput, clearPendingInput } = host;

  const panel = useMemo<PanelContext>(() => {
    const elsewhere = new Set<Uuid>();
    for (const c of tree.concepts) for (const e of c.entities) if (e.presence === "elsewhere") elsewhere.add(e.id);
    for (const s of tree.systems) for (const sc of s.schemas) for (const t of sc.tables) if (t.presence === "elsewhere") elsewhere.add(t.id);
    return {
      ...rest,
      ix,
      cardOf,
      elsewhere: (id) => elsewhere.has(id),
      tablesHere: new Set(cards.filter((c) => c.kind === "src").map((c) => c.targetId)),
      entitiesHere: new Set(cards.filter((c) => c.kind === "ent").map((c) => c.targetId)),
      mapColumn,
      pendingInput,
      clearPendingInput,
      goEntity: (entityId) => {
        const card = cardOf(entityId);
        if (!card) return;
        ui.select({ t: "card", id: card });
        ui.centerOn(card);
      },
      goAttribute: (attributeId) => {
        const card = cardOf(ix.attribute.get(attributeId)?.entity_id ?? "");
        if (card) ui.select({ t: "row", cardId: card, id: attributeId });
      },
      goMapping: (mappingId) => ui.select({ t: "map", id: mappingId }),
      goColumn: (columnId) => {
        const card = cardOf(ix.column.get(columnId)?.source_table_id ?? "");
        if (card) ui.select({ t: "row", cardId: card, id: columnId });
      },
    };
  }, [cards, tree, rest, ix, ui, cardOf, mapColumn, pendingInput, clearPendingInput]);

  const sel = ui.selection;
  let body: ReactNode = (
    <OverviewPanel
      entityIds={cards.filter((c) => c.kind === "ent").map((c) => c.targetId)}
      tableCount={cards.filter((c) => c.kind === "src").length}
      canvasName={rest.canvasName}
      canvasCount={rest.canvasCount}
    />
  );
  const card = sel?.t === "card" || sel?.t === "row" ? cards.find((c) => c.id === (sel.t === "card" ? sel.id : sel.cardId)) : null;
  if (sel?.t === "card" && card?.kind === "ent" && ix.entity.has(card.targetId)) {
    body = <EntityPanel key={card.targetId} entity={ix.entity.get(card.targetId)!} cardId={card.id} />;
  } else if (sel?.t === "card" && card?.kind === "src" && ix.table.has(card.targetId)) {
    body = <SourceTablePanel key={card.targetId} table={ix.table.get(card.targetId)!} cardId={card.id} />;
  } else if (sel?.t === "row" && card?.kind === "ent" && ix.attribute.has(sel.id)) {
    body = <AttributePanel key={sel.id} attribute={ix.attribute.get(sel.id)!} />;
  } else if (sel?.t === "row" && card?.kind === "src" && ix.column.has(sel.id)) {
    body = <SourceColumnPanel key={sel.id} column={ix.column.get(sel.id)!} cardId={card.id} />;
  } else if (sel?.t === "map" && ix.mapping.has(sel.id)) {
    body = <MappingPanel key={sel.id} mapping={ix.mapping.get(sel.id)!} />;
  } else if (sel?.t === "rel" && ix.model.relationships.some((r) => r.id === sel.id)) {
    body = <RelationshipPanel key={sel.id} relationship={ix.model.relationships.find((r) => r.id === sel.id)!} />;
  }

  return (
    <Ctx.Provider value={panel}>
      <div className="flex-1 overflow-auto px-4 pb-6 pt-4 text-[13px]" data-testid="inspector-body">
        {body}
      </div>
      {host.elements}
    </Ctx.Provider>
  );
}

