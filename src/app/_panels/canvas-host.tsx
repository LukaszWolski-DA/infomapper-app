"use client";

// What the canvas asks of the page (slice 1b): it knows gestures, this knows the model and runs the writes.
// - A dropped column (D-48, `useMapColumn`).
// - A new entity from the Entity tool or the toolbox (D-46): in the concept used last, else the first one; its name is
//   ready to type in the right panel.
// - A relationship from one entity card to another, then its panel for the label and cardinality.
// - Slice 10a (D-61): “Relate to itself” in an entity card header's menu; the relate button on the same card refuses.
// - The toolbox for what was right-clicked (D-19), with the actions of the prototype that exist so far. A row's toolbox
//   has only that row's actions; the card's are in its header's toolbox (D-52).
// - Ctrl/Alt + arrows on a selected attribute (D-36).
// - Delete on a selected mapping or relationship line: deleted at once, with Undo in the toast (slice 1b).
// - Slice 10a: the writes on a model row (a line's status, split, swap, delete; an attribute's delete) save through the
//   row's save chain (`saveRow`), as the panel's fields do, so the two never refuse each other as a conflict.
// - “Show its sources” and “Show the entities it feeds” place them beside the card (B-08).
// - Frames (slice 2b): “New frame here” on the empty canvas; a frame's toolbox (Rename…, Fit frame to its content,
//   Select its cards, Zoom to frame, Delete frame); a new frame's name is ready to type in the panel. Slice 2c:
//   “Collapse into one block” or “Expand”; a collapsed frame offers no fit and “Select its cards” is disabled.
// - Notes (slice 3a): “Add a note here”, “Add a note to this”, “Add a note to this frame”, and a note's own toolbox
//   (Edit text, Mark as resolved / Reopen, Colour, Unpin, Delete note), for editors and reviewers (`canNote`).
// - Slice 10c (D-63): “Copy” in an attribute row's menu puts it in the page's clipboard (`attribute-clipboard.ts`);
//   “Paste attribute “…”” in an entity card header's menu pastes a copy and opens its panel with the name selected. An
//   attribute's delete asks for a second click when it has mappings or copies, naming the copies.
// - Slice 16 (item 1, D-71): “Add attribute” in an entity card header's menu, directly before “Paste attribute”: the
//   entity panel's command, its panel opened with the name selected (D-54); the card's collapse and filter stay.
// - Slice 15c (C4, C5, C7, C8): a module's objects on the canvas (`CANVAS_EXTENSIONS`): an entity row's drag and drop,
//   the line's menu, Delete, a history place's text. A column's drag on a canvas with facts or dimensions keeps the
//   dimensional cards under the veil and refuses a drop on them in the browser (B-6's toast); no "Map from a column…"
//   on a dimensional row (difference 9).

import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deleteMappingAction, setMappingStatusAction, splitMappingAction } from "@/app/_actions/mapping";
import { useModules } from "@/app/_components/modules";
import { isLogical, MAPPING_TO_DIMENSIONAL_MESSAGE } from "@/domain/model/levels";
import { CANVAS_EXTENSIONS } from "@/compose/canvas";
import type { CanvasExtHandlers } from "@/canvas/extensions";
import type { EntityCreate } from "@/ui/modules";
import { addAttributeAction, createEntityAction, createRelationshipAction, deleteAttributeAction, deleteRelationshipAction, pasteAttributeAction, swapRelationshipAction } from "@/app/_actions/model";
import { attributeClipboard, useClippedAttribute } from "@/app/_components/attribute-clipboard";
import { useAction } from "@/app/_components/use-action";
import { HAND_TOOL_HINT, RELATE_HINT } from "@/canvas/CanvasModes";
import { newCardHeight } from "@/canvas/geometry";
import { FILTER_LABEL, filtersOf } from "@/canvas/CardNode";
import { CanvasUiCtx, type RowDrag, type RowDragFrom, type RowDrop, type RowFilter, type ToolboxRequest } from "@/canvas/context";
import { isCardKey, isReqKey } from "@/canvas/selection";
import { focusOn } from "@/canvas/fade";
import { toggleFocus } from "@/canvas/Focus";
import type { Uuid } from "@/domain/ids";
import { copiesStopFollowing } from "@/domain/model/copies";
import { attributeCopiesImpact } from "@/domain/model/impact";
import { NOTE_COLORS, type MappingStatus } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { attributeDeleted, STATUS_LABEL } from "./attribute-panel";
import { DeleteEntityDialog } from "./delete-entity-dialog";
import { useMapColumn } from "./map-column";
import { armedDeleteText, attributeDeleteParts, relationshipDeleteAsks } from "./fields";
import { calculationsLoseInput } from "@/domain/model/derivations";
import { useMoveAttribute } from "./move-attribute";
import { attributeLabel, columnLabel, fedEntities, feedingSourceCards, feedingSources, inputsLabel, type ModelIndex } from "./model-index";
import { usePanels } from "./panels-context";
import { pickConcept } from "./concept-pick";
import { useSidePanels } from "../_components/side-panels";
import { Toolbox, type SearchResult, type ToolboxItem } from "./toolbox";

/** A card of this canvas as the host needs it. */
/** A card's names or aliases in its header's menu (slice 11, F5). */
const NAME_CHOICES = [
  { value: "name", label: "Name" },
  { value: "alias", label: "Alias" },
] as const;

export interface HostCard {
  id: Uuid;
  kind: "ent" | "src";
  targetId: Uuid;
  collapsed: boolean;
  rowFilter: RowFilter;
  /** On a live canvas (slice 3b). */
  liveLevel: "full" | "context" | null;
}

const snap8 = (v: number) => Math.round(v / 8) * 8;
/** The menus' item that opens an element panel's requirement picker (slice 17, D-72). */
const LINK_REQUIREMENTS = "Link to requirements…";
const MAX_RESULTS = 8;

/**
 * Focuses a field of the right panel once it is there (the panel renders after the selection changes) and shown (a
 * hidden panel is inert until it opens, slice 5a).
 */
function focusField(id: string, tries = 20) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  // a folded section opens first (D-35), then its button's picker opens under it (slice 17: `data-pop`)
  const fold = el?.closest("section")?.querySelector<HTMLButtonElement>(":scope > h3 > button[aria-expanded=false]");
  if (el && fold && el.closest("[hidden]")) {
    fold.click();
    setTimeout(() => focusField(id, tries - 1), 30);
  } else if (el && !el.disabled && !el.closest("[inert]") && el.dataset.pop !== undefined) {
    el.click();
  } else if (el && !el.disabled && !el.closest("[inert]")) {
    el.focus();
    if ("select" in el && el.tagName !== "SELECT") el.select();
  } else if (tries > 0) setTimeout(() => focusField(id, tries - 1), 30);
}

export function useCanvasHost({
  ix,
  workspaceId,
  canvasId,
  editable,
  canSetStatus,
  canNote,
  cards,
  live = null,
}: {
  ix: ModelIndex;
  workspaceId: string;
  canvasId: string;
  editable: boolean;
  canSetStatus: boolean;
  /** May write notes (slice 3a): editors and reviewers. */
  canNote: boolean;
  cards: readonly HostCard[];
  /** This canvas's label when it is a live canvas (slice 3b). */
  live?: { labelId: Uuid; labelName: string } | null;
}) {
  const ui = useContext(CanvasUiCtx);
  const panels = usePanels();
  // actions that lead to the details panel on purpose open it when it is hidden (slice 5a, Q4); a selection does not
  const { openDetails } = useSidePanels();
  const focusDetails = (id: string) => {
    openDetails();
    focusField(id);
  };
  const { run, saveRow, saveRows } = useAction();
  const toast = useToast();
  const [toolbox, setToolbox] = useState<ToolboxRequest | null>(null);
  const [deleting, setDeleting] = useState<Uuid | null>(null);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const cardOf = useCallback((targetId: Uuid) => cards.find((c) => c.targetId === targetId)?.id ?? null, [cards]);
  const columns = useMapColumn({ ix, workspaceId, editable, cardOf });
  const moveAttribute = useMoveAttribute(ix, workspaceId);
  // the copied attribute (slice 10c): only one of this workspace and still in its model is offered for pasting
  const clippedId = useClippedAttribute(workspaceId);
  const clipped = clippedId ? ix.attribute.get(clippedId) : undefined;
  useEffect(() => {
    const held = attributeClipboard.get();
    if (held && held.workspaceId !== workspaceId) attributeClipboard.set(null);
  }, [workspaceId]);

  const modules = useModules();
  // the modules' objects on the canvas (slice 15c): one hook per registered kind, in the registry's fixed order
  const extContext = useMemo(() => ({ workspaceId, canvasId, editable, canSetStatus, model: ix.model, cards }), [workspaceId, canvasId, editable, canSetStatus, ix.model, cards]);
  const exts: { kind: string; h: CanvasExtHandlers }[] = [];
  // a fixed list: the same hooks in the same order on every render
  for (const e of CANVAS_EXTENSIONS) exts.push({ kind: e.kind, h: e.useHandlers(extContext) });
  const extOf = (kind: string) => exts.find((e) => e.kind === kind)?.h;

  /** A live logical attribute: its row's drag onto a column is InfoMapper's (slice 21, X1). */
  const isLogicalAttribute = (attributeId: Uuid) => {
    const entityId = ix.attribute.get(attributeId)?.entity_id;
    const entity = entityId ? ix.entity.get(entityId) : undefined;
    return !!entity && isLogical(entity);
  };

  /**
   * A row's drag (slice 15c): a column's maps onto logical entity rows and cards; with facts or dimensions on the
   * canvas they stay under the veil and a drop on them is refused with B-6's toast. An entity row's is a module's.
   * Slice 21 (X1, D-76): a logical row's drag is InfoMapper's too, composed with the module's: the table cards stay lit
   * (beside the module's facts and dimensions) and a column takes the drop as the column dropped on the row would; every
   * other target is the module's, or nothing without the module's drag (F2). No drag without a table card on the
   * canvas and without the module's. A dimensional row's stays the module's (its refusal on a column).
   */
  const rowDrag = (from: RowDragFrom): RowDrag | null => {
    if ("attributeId" in from) {
      let moduleDrag: RowDrag | null = null;
      for (const e of exts) {
        moduleDrag = e.h.rowDrag(from.attributeId);
        if (moduleDrag) break;
      }
      const tables = cards.filter((c) => c.kind === "src").map((c) => c.targetId);
      if (!isLogicalAttribute(from.attributeId) || !tables.length) return moduleDrag;
      const fromModule = moduleDrag;
      return {
        lit: { entities: fromModule?.lit?.entities ?? [], tables: [...new Set([...(fromModule?.lit?.tables ?? []), ...tables])] },
        plan: (t) => ("columnId" in t ? "ok" : fromModule ? fromModule.plan(t) : "none"),
      };
    }
    const dimensional = new Set(cards.filter((c) => c.kind === "ent" && ix.entity.get(c.targetId) && !isLogical(ix.entity.get(c.targetId)!)).map((c) => c.targetId));
    const onDimensional = (entityId: string | undefined) => !!entityId && dimensional.has(entityId);
    return {
      lit: dimensional.size ? { entities: cards.filter((c) => c.kind === "ent" && !dimensional.has(c.targetId)).map((c) => c.targetId), tables: cards.filter((c) => c.kind === "src").map((c) => c.targetId) } : null,
      plan: (t) => {
        if ("columnId" in t) return "none";
        return onDimensional("attributeId" in t ? ix.attribute.get(t.attributeId)?.entity_id : t.entityId) ? { refuse: MAPPING_TO_DIMENSIONAL_MESSAGE } : "ok";
      },
    };
  };
  /**
   * An entity row's drop: a logical row on a column maps them as the column dropped on the row does (slice 21, X1:
   * D-48's direct mapping or choice, the hint, the toast, the selection); otherwise the module whose drag it is decides
   * (only one module drags entity rows today).
   */
  const dropRow = (drop: RowDrop) => {
    if ("columnId" in drop.target && isLogicalAttribute(drop.attributeId)) {
      if (editable) columns.mapColumn(drop.target.columnId, drop.attributeId, drop.at);
      return;
    }
    for (const e of exts) if (e.h.rowDrag(drop.attributeId)) return e.h.drop(drop);
  };
  const rowDragRef = useRef(rowDrag);
  const dropRowRef = useRef(dropRow);
  const extsRef = useRef(exts);
  useEffect(() => {
    rowDragRef.current = rowDrag;
    dropRowRef.current = dropRow;
    extsRef.current = exts;
  });

  /**
   * "New entity here", or a module's create ("New fact here", slice 15a, E18): the same placement and focus. Inside a
   * concept frame the new entity belongs to its concept (D-46, prototype conceptAt); elsewhere the concept is chosen in
   * a picker at `screen`, the click or the toolbox's point (slice 17, D-72). Escape there creates nothing.
   */
  const createEntityAt = useCallback(
    (at: { x: number; y: number }, o: { name?: string; create?: EntityCreate; screen?: { x: number; y: number } } = {}) => {
      if (!editable) return;
      const concepts = [...ix.model.concepts].sort((a, b) => a.sort_order - b.sort_order);
      const frame = ui.frameAt({ x: at.x + 24, y: at.y + 20 });
      const fromFrame = frame?.kind === "concept" ? concepts.find((c) => c.id === frame.conceptId) : undefined;
      /** In a concept, or (slice 21, D-76) in a new one named in the picker, made in the same undo step. */
      const create = async (into: { conceptId: string } | { newConcept: { name: string } }) => {
        const { name } = o;
        // with its height the new card joins the frame it lands in (slice 2b)
        const placement = { canvasId, x: snap8(at.x), y: snap8(at.y), height: newCardHeight(0), frames: ui.frameRefs() };
        const result = await run(() =>
          o.create
            ? (o.create.action(workspaceId, { ...into, placement }) as ReturnType<typeof createEntityAction>)
            : createEntityAction(workspaceId, { ...into, ...(name ? { name } : {}), placement }),
        );
        if (!result.ok) return;
        const cardId = result.value.canvasItemId;
        if (cardId) ui.select({ t: "card", id: cardId });
        const where = `${"newConcept" in into ? "the new concept " : ""}${result.value.concept.name}${live ? `, labeled ${live.labelName}` : ""}`;
        if (name) toast(`Created ${result.value.name} in ${where}.`);
        else {
          // on a live canvas the new entity is labeled at once, without a question (PRD item 10)
          toast(`Created ${result.value.name} in ${where}. Type its name now; change the concept in the panel.`);
          if (cardId) {
            openDetails();
            panels.setNameFocus(cardId);
          }
        }
      };
      if (fromFrame) {
        void create({ conceptId: fromFrame.id });
        return;
      }
      const role = o.create ? (o.create.key === "fact" ? "fact" : "dimension") : "entity";
      pickConcept(
        o.screen ?? { x: window.innerWidth / 2 - 130, y: window.innerHeight / 3 },
        role,
        concepts,
        (c) => void create({ conceptId: c.id }),
        (conceptName) => void create({ newConcept: { name: conceptName } }),
      );
    },
    [editable, ix, panels, toast, run, workspaceId, canvasId, ui, live, openDetails],
  );

  const relate = useCallback(
    async (fromCardId: Uuid, toCardId: Uuid) => {
      if (!editable) return;
      const from = cardById.get(fromCardId), to = cardById.get(toCardId);
      if (from?.kind !== "ent" || to?.kind !== "ent") return;
      if (from.id === to.id) {
        toast("Pick a different entity, or use “Relate to itself” in the card's menu.");
        return;
      }
      const result = await run(
        () => createRelationshipAction(workspaceId, { fromEntityId: from.targetId, toEntityId: to.targetId }),
        "Relationship added. Name it and set the cardinality on the right.",
      );
      if (result.ok) ui.select({ t: "rel", id: result.value.relationshipId });
    },
    [editable, cardById, toast, run, workspaceId, ui],
  );

  /**
   * A relationship from the card's entity to itself (slice 10a, D-61), from the card header's menu. It leads to the
   * panel's fields, so a hidden details panel opens (D-54, F13); the relate button keeps the panel as it is.
   */
  const relateToItself = useCallback(
    async (card: HostCard) => {
      if (!editable || card.kind !== "ent") return;
      const result = await run(
        () => createRelationshipAction(workspaceId, { fromEntityId: card.targetId, toEntityId: card.targetId }),
        "Relationship added. Name it and set the cardinality on the right.",
      );
      if (!result.ok) return;
      ui.select({ t: "rel", id: result.value.relationshipId });
      openDetails();
    },
    [editable, run, workspaceId, ui, openDetails],
  );

  /**
   * “Paste attribute” (slice 10c, item 4): a copy of the clipboard's attribute, last on the card's entity. It leads to the
   * new attribute's name, so a hidden details panel opens (D-54), as for “Relate to itself”. A refusal empties the
   * clipboard: the attribute is gone, or the paste cannot be made here.
   */
  const pasteInto = useCallback(
    async (card: HostCard, attributeId: Uuid) => {
      if (!editable || card.kind !== "ent") return;
      const name = ix.attribute.get(attributeId)?.name ?? "";
      const entity = ix.entity.get(card.targetId)?.name ?? "";
      const result = await run(
        () => pasteAttributeAction(workspaceId, { entityId: card.targetId, attributeId }),
        (v) => (v.nameTaken ? `Pasted “${name}” into ${entity}, which already has an attribute of that name.` : `Pasted “${name}” into ${entity}.`),
      );
      if (!result.ok) {
        attributeClipboard.set(null);
        return;
      }
      ui.select({ t: "row", cardId: card.id, id: result.value.attributeId });
      openDetails();
      panels.setNameFocus(result.value.attributeId);
    },
    [editable, ix, run, workspaceId, ui, openDetails, panels],
  );

  /**
   * “Add attribute” (slice 16, item 1): the entity panel's command from the card header's menu. It leads to the new
   * attribute's name, so a hidden details panel opens (D-54), as for “Paste attribute”. A collapsed card or a row filter
   * that hides the new row stays as it is: the panel shows the attribute. `below` (slice 17, item 5: “Add attribute
   * below” in a row's menu): directly below that attribute; the entity's attributes are renumbered, so the save holds
   * them all (`saveRows`, as a move) and their next saves carry the new versions.
   */
  const addAttributeTo = useCallback(
    async (card: HostCard, below?: Uuid) => {
      if (!editable || card.kind !== "ent") return;
      const siblings = below ? (ix.attributesOf.get(card.targetId) ?? []) : [];
      const result = below
        ? await saveRows(siblings.map((a) => ({ id: a.id })), () => addAttributeAction(workspaceId, { entityId: card.targetId, below }))
        : await run(() => addAttributeAction(workspaceId, { entityId: card.targetId }));
      if (!result.ok) return;
      ui.select({ t: "row", cardId: card.id, id: result.value.attributeId });
      openDetails();
      panels.setNameFocus(result.value.attributeId);
    },
    [editable, ix, run, saveRows, workspaceId, ui, openDetails, panels],
  );

  /** Deletes a mapping or a relationship at once; the toast offers Undo (slice 1b). */
  const deleteLine = useCallback(
    async (line: { t: "map" | "rel"; id: Uuid }, confirmed = false) => {
      if (!editable) return;
      // slice 18 (F14): a relationship with lookups through it is deleted after its second click (its menu or panel);
      // the Delete key says so instead
      const lookups = line.t === "rel" ? modules.relationshipDeletes[line.id]?.then : undefined;
      if (lookups?.length && !confirmed) {
        toast(relationshipDeleteAsks(lookups.join("; ")));
        return;
      }
      if (line.t === "map") {
        const m = ix.mapping.get(line.id);
        if (!m) return;
        const r = await saveRow(m, (v) => deleteMappingAction(workspaceId, { mappingId: m.id, expectedVersion: v }), "Mapping deleted", { undoable: true, deletes: true });
        if (r.ok) ui.select(null);
      } else {
        const rel = ix.model.relationships.find((x) => x.id === line.id);
        if (!rel) return;
        const r = await saveRow(rel, (v) => deleteRelationshipAction(workspaceId, { relationshipId: rel.id, expectedVersion: v }), "Relationship deleted", {
          undoable: true,
          deletes: true,
        });
        if (r.ok) ui.select(null);
      }
    },
    [editable, ix, saveRow, workspaceId, ui, modules, toast],
  );

  useEffect(() => {
    const ext = (kind: string) => extsRef.current.find((e) => e.kind === kind)?.h;
    ui.registerHost({
      dropColumn: columns.dropColumn,
      rowDrag: (from) => rowDragRef.current(from),
      dropRow: (drop) => dropRowRef.current(drop),
      deleteExt: (kind, id) => {
        if (editable) ext(kind)?.remove(id);
      },
      extGone: (kind, id) => ext(kind)?.gone(id) ?? null,
      createEntityAt: (at, o) => createEntityAt(at, o),
      relate: (from, to) => void relate(from, to),
      openToolbox: setToolbox,
      moveAttribute: (attributeId, how) => {
        if (editable) void moveAttribute(attributeId, how);
      },
      deleteLine: (line) => void deleteLine(line),
      frameCreated: (frameId) => {
        openDetails();
        panels.setNameFocus(frameId);
      },
      openDetails,
    });
    return () => ui.registerHost(null);
  }, [ui, columns.dropColumn, createEntityAt, relate, moveAttribute, editable, deleteLine, panels, openDetails]);

  // ---- the toolbox ----

  const cardItems = (card: HostCard): ToolboxItem[] => {
    const items: ToolboxItem[] = [];
    const isEnt = card.kind === "ent";
    // What the canvas shows now: a collapse or filter is saved without a fresh page.
    const view = ui.cardView(card.id) ?? card;
    // a live canvas adds cards one at a time (PRD item 12): no “Show its sources”
    if (editable && !live) {
      // Feeding sources (left) or fed entities (right), placed beside the card (B-08).
      const missing = isEnt
        ? feedingSources(ix, card.targetId)
            .filter((f) => !cardOf(f.table.id))
            .map((f) => ({ target: { sourceTableId: f.table.id }, rows: (ix.columnsOf.get(f.table.id) ?? []).length }))
        : fedEntities(ix, card.targetId)
            .filter((f) => !cardOf(f.entity.id))
            .map((f) => ({ target: { entityId: f.entity.id }, rows: (ix.attributesOf.get(f.entity.id) ?? []).length }));
      const n = missing.length;
      items.push({
        label: isEnt ? (n ? `Show its sources (${n})` : "Sources are all on this canvas") : n ? `Show the entities it feeds (${n})` : "Fed entities are all on this canvas",
        disabled: !n,
        act: () => ui.placeBeside(missing, card.id, isEnt ? "left" : "right"),
      });
    }
    if (isEnt && editable) {
      items.push({
        label: "Draw a relationship from here",
        act: () => {
          ui.setMode({ kind: "relate", fromCardId: card.id });
          toast(RELATE_HINT);
        },
      });
      items.push({ label: "Relate to itself", act: () => void relateToItself(card) });
      items.push({ label: "Add attribute", act: () => void addAttributeTo(card) });
      if (clipped) items.push({ label: `Paste attribute “${clipped.name}”`, act: () => void pasteInto(card, clipped.id) });
    }
    if (editable) {
      items.push({
        seg: "Rows",
        options: filtersOf(card).map((f) => ({ label: FILTER_LABEL[f], on: view.rowFilter === f, act: () => ui.setCardView(card.id, { rowFilter: f }) })),
      });
      // what an entity card shows, name or alias, against its canvas (slice 11, F5): the choice equal to the canvas's
      // mode follows the canvas again
      const names = isEnt ? ui.cardView(card.id) : null;
      if (names) {
        for (const [seg, key, testId] of [["Entity name", "entityNames", "seg-entity-name"], ["Attribute names", "attributeNames", "seg-attribute-names"]] as const) {
          items.push({ seg, testId, options: NAME_CHOICES.map((c) => ({ label: c.label, on: names[key] === c.value, act: () => ui.setCardView(card.id, { [key]: c.value }) })) });
        }
      }
      items.push({ label: view.collapsed ? "Expand card" : "Collapse card", act: () => ui.setCardView(card.id, { collapsed: !view.collapsed }) });
      items.push({ label: "Fit width to names", act: () => ui.fitWidth(card.id) });
      // the panel's picker (slice 17, D-72; prototype ctxFor's "Link to a requirement…")
      items.push({ label: LINK_REQUIREMENTS, act: () => focusDetails(isEnt ? "f-req-entity" : "f-req-source_table") });
      if (canNote) items.push({ label: "Add a note to this", act: () => ui.newNote({ cardId: card.id }) });
      if (!ui.cardFrame(card.id)) {
        items.push({ label: `Put in a new ${isEnt ? "concept" : "source system"} frame`, act: () => ui.putInNewFrame([card.id], true) });
      }
      items.push(focusItem());
      items.push({ sep: true });
      // on a live canvas removing a card takes its label off, after the question (PRD item 11)
      items.push({ label: live ? "Remove from this canvas (unlabel)…" : "Remove from this canvas", danger: true, act: () => ui.remove(card.id) });
      // a module's items (slice 15c, P19: "Create dimension from this…"), then the delete
      if (isEnt) for (const e of exts) items.push(...(e.h.cardMenu?.(card.targetId) ?? []));
      if (isEnt) items.push({ label: "Delete from model…", danger: true, act: () => setDeleting(card.targetId) });
    } else {
      if (canNote) items.push({ label: "Add a note to this", act: () => ui.newNote({ cardId: card.id }) });
      items.push(focusItem());
    }
    return items;
  };

  // Focus (slice 4b-1, item 20; prototype ctxFor): in the card and row menus, for every role; the right-click has
  // already selected what Focus will be on
  const focusItem = (): ToolboxItem => ({ label: focusOn.get() ? "Turn Focus off" : "Focus on this", testId: "toolbox-focus", act: () => toggleFocus(ui.selection, toast) });

  const cardName = (card: HostCard) => (card.kind === "ent" ? ix.entity.get(card.targetId)?.name : ix.table.get(card.targetId)?.name) ?? "";

  const search = (query: string): SearchResult[] => {
    const q = query.trim().toLowerCase();
    const here = (id: Uuid) => cardOf(id) !== null;
    const found: (SearchResult & { here: boolean })[] = [
      ...ix.model.entities
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .map((e) => ({ key: e.id, label: e.name, kind: "ent" as const, here: here(e.id), meta: here(e.id) ? "on canvas" : (ix.conceptName.get(e.concept_id) ?? ""), id: e.id })),
      ...ix.model.sourceTables
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .map((t) => ({ key: t.id, label: t.name, kind: "src" as const, here: here(t.id), meta: here(t.id) ? "on canvas" : (ix.systemName.get(t.source_system_id) ?? ""), id: t.id })),
    ]
      .sort((a, b) => Number(a.here) - Number(b.here))
      .slice(0, MAX_RESULTS)
      .map(({ id, ...r }) => ({
        ...r,
        pick: () => {
          const cardId = cardOf(id);
          if (cardId) {
            ui.select({ t: "card", id: cardId });
            ui.centerOn(cardId);
          } else if (toolbox) {
            const rows = r.kind === "ent" ? (ix.attributesOf.get(id) ?? []).length : (ix.columnsOf.get(id) ?? []).length;
            ui.placeAt(r.kind === "ent" ? { entityId: id } : { sourceTableId: id }, rows, toolbox.at);
          }
        },
      }));
    const name = query.trim();
    // names are compared within one level (slice 15a, Q4): this creates a logical entity
    if (name && !ix.model.entities.some((e) => isLogical(e) && e.name.toLowerCase() === name.toLowerCase())) {
      found.unshift({
        key: "new",
        label: `Create entity “${name}”`,
        meta: "new entity",
        kind: "new",
        here: false,
        pick: () => toolbox && createEntityAt({ x: toolbox.at.x - 24, y: toolbox.at.y - 20 }, { name, screen: toolbox.screen }),
      });
    }
    return found;
  };

  const items = (req: ToolboxRequest): ToolboxItem[] => {
    const t = req.target;
    const items: ToolboxItem[] = [];
    if (t.kind === "canvas") {
      if (editable) {
        items.push({ search });
        items.push({ label: "New entity here", kbd: "E", act: () => createEntityAt({ x: req.at.x - 24, y: req.at.y - 20 }, { screen: req.screen }) });
        // a module's creates, after it (prototype: "New fact here", "New dimension here"; slice 15a, B-2)
        for (const c of modules.creates) items.push({ label: c.here, act: () => createEntityAt({ x: req.at.x - 24, y: req.at.y - 20 }, { create: c, screen: req.screen }) });
      }
      // a note here: its corner up-left of the click, as the prototype's “Add a note here”
      if (canNote) items.push({ label: "Add a note here", act: () => ui.newNote({ at: { x: req.at.x - 110, y: req.at.y - 20 } }) });
      if (editable) items.push({ label: "New frame here", kbd: "A", act: () => ui.createFrameAt(req.at) });
      // every role: these only change what is selected or how the view moves (slice 2a)
      items.push({ label: "Select all", kbd: "Ctrl A", act: () => ui.selectAll() });
      items.push({ label: "Fit everything on screen", kbd: "F", act: () => ui.fit() });
      const hand = ui.mode?.kind === "hand";
      items.push({
        label: hand ? "Back to selecting" : "Hand tool",
        kbd: hand ? "V" : "H",
        act: () => {
          ui.setMode(hand ? null : { kind: "hand" });
          if (!hand) toast(HAND_TOOL_HINT);
        },
      });
      return items;
    }
    if (t.kind === "map") {
      const m = ix.mapping.get(t.mappingId);
      if (!m) return items;
      items.push({ head: `${inputsLabel(ix, m.id)} → ${attributeLabel(ix, m.attribute_id)}` });
      if (canSetStatus) {
        for (const status of ["draft", "review", "approved"] as MappingStatus[]) {
          items.push({
            label: STATUS_LABEL[status],
            checked: m.status === status,
            act: () => void saveRow(m, (v) => setMappingStatusAction(workspaceId, { mappingId: m.id, expectedVersion: v, status })),
          });
        }
      }
      if (editable) {
        items.push({ label: LINK_REQUIREMENTS, act: () => focusDetails("f-req-mapping") });
        items.push({ sep: true });
        items.push({ label: "Edit transformation rule…", act: () => {
          openDetails();
          panels.setRuleFocus(m.id);
        } });
        if ((ix.inputsOf.get(m.id) ?? []).length > 1) {
          items.push({
            label: "Split into separate mappings",
            act: () =>
              void saveRow(
                m,
                (v) => splitMappingAction(workspaceId, { mappingId: m.id, expectedVersion: v }),
                (v) => v.notice ?? `Split into ${v.mappings} separate mappings.`,
              ),
          });
        }
        if ((ix.mappingsOf.get(m.attribute_id) ?? []).length > 1) {
          items.push({ label: "Merge mappings…", act: () => {
            openDetails();
            panels.setMergeFocus(m.id);
          } });
        }
        items.push({
          label: "Delete mapping",
          danger: true,
          kbd: "Del",
          act: () => void deleteLine({ t: "map", id: m.id }),
        });
      }
      return items;
    }
    if (t.kind === "ext") {
      // a module's line (slice 15c): its own menu
      items.push(...(extOf(t.extKind)?.menu(t.id) ?? []));
      return items;
    }
    if (t.kind === "rel") {
      const r = ix.model.relationships.find((x) => x.id === t.relationshipId);
      if (!r) return items;
      items.push({ head: `${ix.entity.get(r.from_entity_id)?.name ?? "?"} – ${ix.entity.get(r.to_entity_id)?.name ?? "?"}` });
      if (editable) {
        items.push({ label: "Edit name and cardinality…", act: () => focusDetails("f-rl") });
        items.push({ label: "Swap direction", act: () => void saveRow(r, (v) => swapRelationshipAction(workspaceId, { relationshipId: r.id, expectedVersion: v })) });
        // slice 18 (F14): with lookups through it, a second click that says what they lose
        const lookups = modules.relationshipDeletes[r.id]?.then;
        items.push({
          label: "Delete relationship",
          danger: true,
          kbd: "Del",
          ...(lookups?.length ? { confirm: armedDeleteText(undefined, lookups.join("; ")) } : {}),
          act: () => void deleteLine({ t: "rel", id: r.id }, true),
        });
      }
      return items;
    }
    if (t.kind === "selection") {
      // a group (slice 2a; prototype ctxFor “a group”): reviewers and readers only clear it
      const sel = ui.selection;
      const keys = sel?.t === "multi" ? sel.keys : [];
      // frames stand for their cards (slice 2b): fit widths, put in a new frame and remove act on the selected cards,
      // not on notes (slice 3a)
      const cardKeys = keys.filter(isCardKey);
      items.push({ head: `${keys.length} items selected` });
      if (editable) {
        items.push({ label: "Align left", act: () => ui.arrangeSelection("left") });
        items.push({ label: "Align top", act: () => ui.arrangeSelection("top") });
        items.push({ label: "Stack in a column", act: () => ui.arrangeSelection("column") });
        items.push({ label: "Line up in a row", act: () => ui.arrangeSelection("row") });
        if (cardKeys.length) items.push({ label: "Fit widths to names", act: () => ui.fitSelectionWidths() });
        items.push({ sep: true });
        if (cardKeys.length) {
          items.push({
            label: "Put in a new frame",
            act: () => ui.putInNewFrame(cardKeys.map((k) => cardOf(k.slice(k.indexOf(":") + 1))).filter((id): id is Uuid => !!id), false),
          });
        }
        // a live canvas adds and removes one card at a time (PRD item 12): no bulk add, no removal of several
        if (keys.some((k) => k.startsWith("entity:")) && !live) {
          items.push({ label: "Add sources of selected entities", act: () => ui.placeSourcesOfSelection((id) => feedingSourceCards(ix, id)) });
        }
        // requirement cards leave with the selection too (slice 4b-2, L)
        if ((cardKeys.length || keys.some(isReqKey)) && !live) items.push({ label: "Remove from this canvas", danger: true, act: () => ui.removeSelection() });
      }
      items.push({ sep: true });
      items.push({ label: "Clear selection", kbd: "Esc", act: () => ui.select(null) });
      return items;
    }
    if (t.kind === "frame") {
      // a frame (slice 2b, prototype ctxFor “a frame”, D-19): reviewers and readers may select, zoom and select its cards
      const view = ui.frameView(t.frameId);
      if (!view) return items;
      items.push({ head: view.frame.name });
      const collapsed = view.frame.collapsed;
      if (editable) items.push({ label: "Rename…", act: () => focusDetails("f-fn"), testId: "toolbox-frame-rename" });
      // slice 2c (D-07): collapse into one block or expand, for every role (reviewers and readers in their own tab
      // only, item 11); a block offers no fit, and its cards are not selectable
      items.push({ label: collapsed ? "Expand" : "Collapse into one block", act: () => ui.setFrameCollapsed(t.frameId, !collapsed), testId: "toolbox-frame-collapse" });
      if (editable && !collapsed) items.push({ label: "Fit frame to its content", act: () => ui.fitFrame(t.frameId), testId: "toolbox-frame-fit" });
      items.push({ label: "Select its cards", disabled: collapsed || !view.cardIds.length, act: () => ui.selectFrameCards(t.frameId), testId: "toolbox-frame-select-cards" });
      items.push({ label: "Zoom to frame", act: () => ui.zoomToFrame(t.frameId), testId: "toolbox-frame-zoom" });
      if (canNote) items.push({ label: "Add a note to this frame", act: () => ui.newNote({ frameId: t.frameId }) });
      if (editable) {
        items.push({ sep: true });
        items.push({ label: "Delete frame (keeps its cards)", kbd: "Del", danger: true, act: () => ui.deleteFrame(t.frameId), testId: "toolbox-frame-delete" });
      }
      return items;
    }
    if (t.kind === "bundle") {
      // a bundle of lines at a collapsed frame (slice 2c, prototype ctxFor “bundle”)
      const b = ui.bundleView(t.key);
      if (!b) return items;
      items.push({ head: `${b.ids.length} bundled ${b.t === "rel" ? "relationships" : "mappings"}` });
      items.push({ label: "Show what is inside", act: () => {
        openDetails();
        ui.select({ t: "bundle", id: b.key });
      }, testId: "toolbox-bundle-show" });
      // every role: reviewers and readers expand in their own tab only (item 11)
      for (const e of [b.a, b.z]) {
        if (!("frameId" in e)) continue;
        const name = ui.frameView(e.frameId)?.frame.name ?? "?";
        items.push({ label: `Expand ${name}`, act: () => ui.setFrameCollapsed(e.frameId, false), testId: "toolbox-bundle-expand" });
      }
      return items;
    }
    if (t.kind === "requirement") {
      // a requirement's card (slice 4b-2, item 7; prototype ctxFor “a requirement card”)
      const card = ui.requirementCard(t.requirementId);
      if (!card) return items;
      items.push({ head: `${card.key} ${card.name}` });
      if (editable) {
        items.push({
          label: "Remove its card from this canvas",
          kbd: "Del",
          danger: true,
          testId: "toolbox-requirement-remove",
          act: () => ui.removeRequirementCard(t.requirementId, { deselect: true }),
        });
      }
      return items;
    }
    if (t.kind === "note") {
      // a note's toolbox (item 10, prototype ctxFor “note”); the prototype's “Edit with formatting…” comes with slice 4
      const view = ui.noteView(t.noteId);
      if (!view || view.draft) return items;
      const n = view.note;
      items.push({ head: view.pinnedTo ? `Note on ${view.pinnedTo.name}` : "Note" });
      if (!canNote) return items;
      items.push({ label: "Edit text", kbd: "Dbl-click", act: () => ui.editNote(n.id) });
      items.push({
        label: n.status === "resolved" ? "Reopen" : "Mark as resolved",
        act: () => ui.updateNote(n.id, { status: n.status === "resolved" ? "open" : "resolved" }),
      });
      items.push({
        seg: "Colour",
        options: NOTE_COLORS.map((c) => ({ label: c.charAt(0).toUpperCase() + c.slice(1), on: n.color === c, act: () => ui.updateNote(n.id, { color: c }) })),
      });
      if (view.pinnedTo) items.push({ label: "Unpin (make it a free note)", act: () => ui.unpinNote(n.id) });
      items.push({ sep: true });
      items.push({ label: "Delete note", kbd: "Del", danger: true, act: () => ui.deleteNote(n.id) });
      return items;
    }
    const card = cardById.get(t.cardId);
    if (!card) return items;
    if (t.kind === "row" && card.kind === "ent") {
      const a = ix.attribute.get(t.rowId);
      if (a) {
        items.push({ head: attributeLabel(ix, a.id) });
        if (editable) {
          const list = ix.attributesOf.get(a.entity_id) ?? [];
          const pos = list.findIndex((x) => x.id === a.id), last = list.length - 1;
          const move = (how: "up" | "down" | "top" | "bottom") => () => void moveAttribute(a.id, how);
          items.push({ label: "Move up", kbd: "Ctrl ↑", disabled: pos <= 0, act: move("up") });
          items.push({ label: "Move down", kbd: "Ctrl ↓", disabled: pos >= last, act: move("down") });
          items.push({ label: "Move to the top", kbd: "Ctrl Shift ↑", disabled: pos <= 0, act: move("top") });
          items.push({ label: "Move to the bottom", kbd: "Ctrl Shift ↓", disabled: pos >= last, act: move("bottom") });
          items.push({ sep: true });
          // slice 17, items 5 and 2a (prototype ctxFor)
          items.push({ label: "Add attribute below", act: () => void addAttributeTo(card, a.id) });
          items.push({ label: LINK_REQUIREMENTS, act: () => focusDetails("f-req-attribute") });
          // a fact or a dimension is fed from the logical model, not from columns (slice 15c, difference 9)
          const entity = ix.entity.get(a.entity_id);
          if (entity && isLogical(entity)) items.push({ label: "Map from a column…", act: () => focusDetails("f-addc") });
          items.push({
            label: "Copy",
            act: () => {
              attributeClipboard.set({ workspaceId, attributeId: a.id });
              toast(`Copied “${a.name}”. Paste it with “Paste attribute” in an entity card's menu.`);
            },
          });
          items.push({ sep: true });
          // the same confirmation as in the attribute panel: with mappings or copies it asks for a second click (F7)
          const n = (ix.mappingsOf.get(a.id) ?? []).length;
          const copies = attributeCopiesImpact(ix.model.attributes, ix.model.entities, a.id).map((c) => c.label);
          // and a module's rows (slice 15b, R4): a measure, a key's link
          // slice 18 (F12): and the calculations that read it
          const calcUsers = ix.derivations.usersOf(a.id).map((id) => ix.attribute.get(id)?.name ?? "?");
          const parts = attributeDeleteParts(n, copies.length ? copiesStopFollowing(copies) : undefined, modules.attributeDeletes[a.id], calculationsLoseInput(calcUsers));
          items.push({
            label: "Delete attribute",
            danger: true,
            ...(parts.also || parts.then ? { confirm: armedDeleteText(parts.also, parts.then) } : {}),
            act: () =>
              void saveRow(
                a,
                (v) => deleteAttributeAction(workspaceId, { attributeId: a.id, expectedVersion: v }),
                attributeDeleted(n, copies.length, modules.attributeDeletes[a.id]?.toast),
                { undoable: true, deletes: true },
              ).then((r) => {
                if (r.ok) ui.select(null);
              }),
          });
        }
        items.push(focusItem());
      }
      return items;
    }
    if (t.kind === "row" && card.kind === "src" && ix.column.has(t.rowId)) {
      items.push({ head: columnLabel(ix, t.rowId) });
      if (editable) {
        items.push({ label: LINK_REQUIREMENTS, act: () => focusDetails("f-req-source_column") });
        items.push({ label: "Map to an attribute…", act: () => focusDetails("f-adda") });
      }
      items.push(focusItem());
      return items;
    }
    items.push({ head: cardName(card) });
    items.push(...cardItems(card));
    return items;
  };

  const closeToolbox = useCallback(() => setToolbox(null), []);
  // Only headings (a reader or reviewer on a card): nothing to offer, so no toolbox.
  const toolboxItems = toolbox ? items(toolbox) : [];
  const offersSomething = toolboxItems.some((i) => !("head" in i) && !("sep" in i));
  const deletingEntity = deleting ? ix.entity.get(deleting) : undefined;
  const elements = (
    <>
      {columns.choiceElement}
      {toolbox && offersSomething && <Toolbox key={`${toolbox.screen.x}:${toolbox.screen.y}`} items={toolboxItems} at={toolbox.screen} onClose={closeToolbox} />}
      {deletingEntity && <DeleteEntityDialog entity={deletingEntity} onClose={() => setDeleting(null)} />}
      {exts.map((e) => (e.h.overlay ? <Fragment key={e.kind}>{e.h.overlay}</Fragment> : null))}
    </>
  );

  return { elements, mapColumn: columns.mapColumn, pendingInput: columns.pendingInput, clearPendingInput: columns.clearPendingInput };
}
