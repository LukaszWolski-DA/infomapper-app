"use client";

// The right panel (prototype #ins): shows and edits what is selected on the canvas: an entity, attribute, mapping,
// relationship, source table or column, a frame (slice 2b), a bundle of lines (slice 2c), a working label or a note (slice 3a),
// a requirement, or an element whose card is not on this canvas (slice 4a: the go-to links' fallback), a source system
// (slice 7a); with nothing selected, an overview of this canvas.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { buildRequirementIndex, type RequirementIndex } from "@/domain/model/requirement-index";
import type { Label, LabelLink, Requirement, RequirementLink, WorkspaceModel } from "@/domain/types";
import { AttributePanel } from "./attribute-panel";
import { BundlePanel } from "./bundle-panel";
import { EntityPanel } from "./entity-panel";
import { FramePanel } from "./frame-panel";
import { LabelPanel } from "./label-panel";
import { NotePanel } from "./note-panel";
import { useCanvasHost, type HostCard } from "./canvas-host";
import type { PendingInput } from "./map-column";
import { MappingPanel } from "./mapping-panel";
import type { ImportData } from "./import/wizard-model";
import type { SystemImport } from "./import/system-imports";
import { indexModel, type ModelIndex } from "./model-index";
import { OverviewPanel } from "./overview-panel";
import { RelationshipPanel } from "./relationship-panel";
import { RequirementPanel } from "./requirement-panel";
import { SelectionPanel } from "./selection-panel";
import { SourceColumnPanel, SourceTablePanel } from "./source-panels";
import { SystemPanel } from "./system-panel";
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
  /** May write notes (slice 3a): editors and reviewers, not archived. */
  canNote: boolean;
  userId: Uuid;
  fourEyes: boolean;
  /** Who last changed each mapping's inputs, kind or rule (AD-06); only filled when four-eyes is on. */
  contentAuthors: Record<Uuid, Uuid>;
  /** Every canvas of the workspace, where it opens and how “On canvases” names it (slice 2a). */
  places: CanvasPlace[];
  /** The canvases each entity or source table has a card on. */
  canvasesOf: Record<Uuid, Uuid[]>;
  /** The workspace's working labels and what they mark (slice 3a). */
  labels: Label[];
  labelLinks: LabelLink[];
  /** The workspace's requirements and their links (slice 4a). */
  requirements: Requirement[];
  requirementLinks: RequirementLink[];
  /** Who last changed each requirement's content (AD-06); only filled when four-eyes is on. */
  requirementAuthors: Record<Uuid, Uuid>;
  /** The open project (live canvases open in it, slice 3b). */
  projectId: Uuid;
  /** Each label's live canvas, by label id (slice 3b). */
  liveCanvases: Record<Uuid, Uuid>;
  /** This canvas's label when it is a live canvas (slice 3b). */
  live: { labelId: Uuid; labelName: string } | null;
  /** May create canvases (opening a new live canvas): owners, admins, modelers. */
  canCreateCanvas: boolean;
  /** Every import of the workspace, newest first (slice 7a, the system panel). */
  imports: SystemImport[];
  /** What the import wizard reads, for “Re-import {system}…”; only for those who may edit. */
  importData?: ImportData;
}

export interface CanvasPlace {
  id: Uuid;
  name: string;
  href: string;
  /** “this canvas”, “open” (another canvas of this project) or “in {project}”. */
  where: string;
  /** The project it opens in, when that is not this one. */
  switchTo: string | null;
}

export interface PanelContext extends Omit<InspectorProps, "model" | "cards" | "tree"> {
  ix: ModelIndex;
  /** The requirement index (slice 4a), built once per data version. */
  rx: RequirementIndex;
  /** The card of an entity or source table on this canvas. */
  cardOf: (targetId: Uuid) => Uuid | null;
  /** Elements on another canvas but not here (rings in the left panel). */
  elsewhere: (targetId: Uuid) => boolean;
  tablesHere: ReadonlySet<Uuid>;
  /**
   * The go-to links: the element's card (or row) on this canvas, selected and its panel open; without a card here, its
   * panel only (slice 4a): no pan, no card added, no canvas switch.
   */
  goEntity: (entityId: Uuid) => void;
  goAttribute: (attributeId: Uuid) => void;
  goMapping: (mappingId: Uuid) => void;
  goColumn: (columnId: Uuid) => void;
  goTable: (tableId: Uuid) => void;
  /** Opens a source system's panel (slice 7a). */
  goSystem: (systemId: Uuid) => void;
  /** Opens a requirement's panel (slice 4a). */
  goRequirement: (requirementId: Uuid) => void;
  /** Opens a working label's panel (slice 3a). */
  goLabel: (labelId: Uuid) => void;
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
  const { requirements, requirementLinks } = rest;
  const rx = useMemo(() => buildRequirementIndex(requirements, requirementLinks, model), [requirements, requirementLinks, model]);
  const cardOf = useMemo(() => {
    const cardByTarget = new Map(cards.map((c) => [c.targetId, c.id]));
    return (id: Uuid) => cardByTarget.get(id) ?? null;
  }, [cards]);
  const host = useCanvasHost({ ix, workspaceId: rest.workspaceId, canvasId: rest.canvasId, editable: rest.editable, canSetStatus: rest.canSetStatus, canNote: rest.canNote, cards, live: rest.live });
  const { mapColumn, pendingInput, clearPendingInput } = host;

  const panel = useMemo<PanelContext>(() => {
    const elsewhere = new Set<Uuid>();
    for (const c of tree.concepts) for (const e of c.entities) if (e.presence === "elsewhere") elsewhere.add(e.id);
    for (const s of tree.systems) for (const sc of s.schemas) for (const t of sc.tables) if (t.presence === "elsewhere") elsewhere.add(t.id);
    return {
      ...rest,
      ix,
      rx,
      cardOf,
      elsewhere: (id) => elsewhere.has(id),
      tablesHere: new Set(cards.filter((c) => c.kind === "src").map((c) => c.targetId)),
      entitiesHere: new Set(cards.filter((c) => c.kind === "ent").map((c) => c.targetId)),
      mapColumn,
      pendingInput,
      clearPendingInput,
      goEntity: (entityId) => {
        const card = cardOf(entityId);
        if (!card) return ui.select({ t: "element", kind: "entity", id: entityId });
        ui.select({ t: "card", id: card });
        ui.centerOn(card);
      },
      goAttribute: (attributeId) => {
        const card = cardOf(ix.attribute.get(attributeId)?.entity_id ?? "");
        ui.select(card ? { t: "row", cardId: card, id: attributeId } : { t: "element", kind: "attribute", id: attributeId });
      },
      goMapping: (mappingId) => ui.select({ t: "map", id: mappingId }),
      goColumn: (columnId) => {
        const card = cardOf(ix.column.get(columnId)?.source_table_id ?? "");
        ui.select(card ? { t: "row", cardId: card, id: columnId } : { t: "element", kind: "source_column", id: columnId });
      },
      goSystem: (systemId) => ui.select({ t: "element", kind: "source_system", id: systemId }),
      goTable: (tableId) => {
        const card = cardOf(tableId);
        if (!card) return ui.select({ t: "element", kind: "source_table", id: tableId });
        ui.select({ t: "card", id: card });
        ui.centerOn(card);
      },
      goLabel: (labelId) => ui.select({ t: "label", id: labelId }),
      goRequirement: (requirementId) => ui.select({ t: "req", id: requirementId }),
    };
  }, [cards, tree, rest, ix, rx, ui, cardOf, mapColumn, pendingInput, clearPendingInput]);

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
    body = <SourceColumnPanel key={sel.id} column={ix.column.get(sel.id)!} />;
  } else if (sel?.t === "map" && ix.mapping.has(sel.id)) {
    body = <MappingPanel key={sel.id} mapping={ix.mapping.get(sel.id)!} />;
  } else if (sel?.t === "frame" && ui.frameView(sel.id)) {
    body = <FramePanel key={sel.id} frameId={sel.id} />;
  } else if (sel?.t === "multi") {
    body = <SelectionPanel keys={sel.keys} />;
  } else if (sel?.t === "bundle" && ui.bundleView(sel.id)) {
    // a bundle of lines at a collapsed frame (slice 2c); a relationship end that is a card is named by its entity
    const entityName = (cardId: Uuid) => ix.entity.get(cards.find((c) => c.id === cardId)?.targetId ?? "")?.name ?? "?";
    body = <BundlePanel key={sel.id} bundle={ui.bundleView(sel.id)!} entityName={entityName} />;
  } else if (sel?.t === "note" && ui.noteView(sel.id)) {
    body = <NotePanel key={sel.id} noteId={sel.id} />;
  } else if (sel?.t === "label" && rest.labels.some((l) => l.id === sel.id)) {
    body = <LabelPanel key={sel.id} label={rest.labels.find((l) => l.id === sel.id)!} />;
  } else if (sel?.t === "req" && rx.byId.has(sel.id)) {
    body = <RequirementPanel key={sel.id} requirement={rx.byId.get(sel.id)!} />;
  } else if (sel?.t === "element" && sel.kind === "entity" && ix.entity.has(sel.id)) {
    body = <EntityPanel key={sel.id} entity={ix.entity.get(sel.id)!} cardId={cardOf(sel.id)} />;
  } else if (sel?.t === "element" && sel.kind === "attribute" && ix.attribute.has(sel.id)) {
    body = <AttributePanel key={sel.id} attribute={ix.attribute.get(sel.id)!} />;
  } else if (sel?.t === "element" && sel.kind === "source_table" && ix.table.has(sel.id)) {
    body = <SourceTablePanel key={sel.id} table={ix.table.get(sel.id)!} cardId={cardOf(sel.id)} />;
  } else if (sel?.t === "element" && sel.kind === "source_column" && ix.column.has(sel.id)) {
    body = <SourceColumnPanel key={sel.id} column={ix.column.get(sel.id)!} />;
  } else if (sel?.t === "element" && sel.kind === "source_system" && ix.model.sourceSystems.some((s) => s.id === sel.id)) {
    body = <SystemPanel key={sel.id} system={ix.model.sourceSystems.find((s) => s.id === sel.id)!} />;
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

