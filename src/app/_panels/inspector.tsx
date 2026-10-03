"use client";

// The right panel (prototype #ins): shows and edits what is selected on the canvas. Slice 1a step 5a: entity,
// attribute and mapping. Source tables, columns, relationships and the overview when nothing is selected are step 5b.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceModel } from "@/domain/types";
import { AttributePanel } from "./attribute-panel";
import { EntityPanel } from "./entity-panel";
import { Kind } from "./fields";
import { MappingPanel } from "./mapping-panel";
import { indexModel, tablePath, type ModelIndex } from "./model-index";
import type { TreeData } from "./tree-data";

export interface InspectorProps {
  workspaceId: string;
  canvasId: string;
  /** The live model of the workspace. */
  model: WorkspaceModel;
  /** The cards of this canvas: card id, what it shows. */
  cards: { id: Uuid; kind: "ent" | "src"; targetId: Uuid }[];
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
}

const Ctx = createContext<PanelContext | null>(null);
export const usePanel = () => useContext(Ctx)!;

export function Inspector({ model, cards, tree, ...rest }: InspectorProps) {
  const ui = useContext(CanvasUiCtx);
  const ix = useMemo(() => indexModel(model), [model]);

  const panel = useMemo<PanelContext>(() => {
    const cardByTarget = new Map(cards.map((c) => [c.targetId, c.id]));
    const elsewhere = new Set<Uuid>();
    for (const c of tree.concepts) for (const e of c.entities) if (e.presence === "elsewhere") elsewhere.add(e.id);
    for (const s of tree.systems) for (const sc of s.schemas) for (const t of sc.tables) if (t.presence === "elsewhere") elsewhere.add(t.id);
    const cardOf = (id: Uuid) => cardByTarget.get(id) ?? null;
    return {
      ...rest,
      ix,
      cardOf,
      elsewhere: (id) => elsewhere.has(id),
      tablesHere: new Set(cards.filter((c) => c.kind === "src").map((c) => c.targetId)),
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
  }, [cards, tree, rest, ix, ui]);

  const sel = ui.selection;
  let body: ReactNode = null;
  const card = sel?.t === "card" || sel?.t === "row" ? cards.find((c) => c.id === (sel.t === "card" ? sel.id : sel.cardId)) : null;
  if (sel?.t === "card" && card?.kind === "ent" && ix.entity.has(card.targetId)) {
    body = <EntityPanel key={card.targetId} entity={ix.entity.get(card.targetId)!} cardId={card.id} />;
  } else if (sel?.t === "card" && card?.kind === "src" && ix.table.has(card.targetId)) {
    const t = ix.table.get(card.targetId)!;
    body = <SourceCard name={t.name} path={tablePath(ix, t)} cardId={card.id} editable={rest.editable} />;
  } else if (sel?.t === "row" && card?.kind === "ent" && ix.attribute.has(sel.id)) {
    body = <AttributePanel key={sel.id} attribute={ix.attribute.get(sel.id)!} />;
  } else if (sel?.t === "map" && ix.mapping.has(sel.id)) {
    body = <MappingPanel key={sel.id} mapping={ix.mapping.get(sel.id)!} />;
  }

  return (
    <Ctx.Provider value={panel}>
      {body ? (
        <div className="flex-1 overflow-auto px-4 pb-6 pt-4 text-[13px]" data-testid="inspector-body">
          {body}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center text-xs text-im-ink-3">
          Details of what you select appear here in a later slice.
        </div>
      )}
    </Ctx.Provider>
  );
}

/** A source table card until its panel arrives (step 5b): what it is and “Remove from this canvas”. */
function SourceCard({ name, path, cardId, editable }: { name: string; path: string; cardId: Uuid; editable: boolean }) {
  const { remove } = useContext(CanvasUiCtx);
  return (
    <div data-testid="inspector-card">
      <Kind>Source table</Kind>
      <h2 className="font-mono text-[15px] font-semibold leading-tight">{name}</h2>
      <p className="mt-1 font-mono text-im-ink-3">{path}</p>
      {editable && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover"
            data-testid="button-remove-card"
            onClick={() => remove(cardId)}
          >
            Remove from this canvas
          </button>
        </div>
      )}
    </div>
  );
}
