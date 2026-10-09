"use client";

// What the canvas asks of the page (slice 1b): it knows gestures, this knows the model and runs the writes.
// - A dropped column (D-48, `useMapColumn`).
// - A new entity from the Entity tool or the toolbox (D-46): in the concept used last, else the first one; its name is
//   ready to type in the right panel.
// - A relationship from one entity card to another, then its panel for the label and cardinality.
// - The toolbox for what was right-clicked (D-19), with the actions of the prototype that exist so far. A row's toolbox
//   has only that row's actions; the card's are in its header's toolbox (D-52).
// - Ctrl/Alt + arrows on a selected attribute (D-36).
// - Delete on a selected mapping or relationship line: deleted at once, with Undo in the toast (slice 1b).
// - “Show its sources” and “Show the entities it feeds” place them beside the card (B-08).
// - Frames (slice 2b): “New frame here” on the empty canvas; a frame's toolbox (Rename…, Fit frame to its content,
//   Select its cards, Zoom to frame, Delete frame); a new frame's name is ready to type in the panel. Slice 2c:
//   “Collapse into one block” or “Expand”; a collapsed frame offers no fit and “Select its cards” is disabled.

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deleteMappingAction, setMappingStatusAction, splitMappingAction } from "@/app/_actions/mapping";
import { createEntityAction, createRelationshipAction, deleteAttributeAction, deleteRelationshipAction, swapRelationshipAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { HAND_TOOL_HINT, RELATE_HINT } from "@/canvas/CanvasModes";
import { newCardHeight } from "@/canvas/geometry";
import { FILTER_LABEL, FILTER_ORDER } from "@/canvas/CardNode";
import { CanvasUiCtx, type RowFilter, type ToolboxRequest } from "@/canvas/context";
import { isFrameKey } from "@/canvas/selection";
import type { Uuid } from "@/domain/ids";
import type { MappingStatus } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { STATUS_LABEL } from "./attribute-panel";
import { DeleteEntityDialog } from "./delete-entity-dialog";
import { useMapColumn } from "./map-column";
import { useMoveAttribute } from "./move-attribute";
import { attributeLabel, columnLabel, fedEntities, feedingSourceCards, feedingSources, inputsLabel, type ModelIndex } from "./model-index";
import { usePanels } from "./panels-context";
import { Toolbox, type SearchResult, type ToolboxItem } from "./toolbox";

/** A card of this canvas as the host needs it. */
export interface HostCard {
  id: Uuid;
  kind: "ent" | "src";
  targetId: Uuid;
  collapsed: boolean;
  rowFilter: RowFilter;
}

const snap8 = (v: number) => Math.round(v / 8) * 8;
const MAX_RESULTS = 8;

/** Focuses a field of the right panel once it is there (the panel renders after the selection changes). */
function focusField(id: string, tries = 20) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (el && !el.disabled) {
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
  cards,
}: {
  ix: ModelIndex;
  workspaceId: string;
  canvasId: string;
  editable: boolean;
  canSetStatus: boolean;
  cards: readonly HostCard[];
}) {
  const ui = useContext(CanvasUiCtx);
  const panels = usePanels();
  const { run } = useAction();
  const toast = useToast();
  const [toolbox, setToolbox] = useState<ToolboxRequest | null>(null);
  const [deleting, setDeleting] = useState<Uuid | null>(null);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const cardOf = useCallback((targetId: Uuid) => cards.find((c) => c.targetId === targetId)?.id ?? null, [cards]);
  const columns = useMapColumn({ ix, workspaceId, editable, cardOf });
  const moveAttribute = useMoveAttribute(ix, workspaceId);

  const createEntityAt = useCallback(
    async (at: { x: number; y: number }, name?: string) => {
      if (!editable) return;
      const concepts = [...ix.model.concepts].sort((a, b) => a.sort_order - b.sort_order);
      const last = panels.lastConcept();
      // inside a concept frame the new entity belongs to its concept (D-46, prototype conceptAt), else the last used
      const frame = ui.frameAt({ x: at.x + 24, y: at.y + 20 });
      const fromFrame = frame?.kind === "concept" ? concepts.find((c) => c.id === frame.conceptId) : undefined;
      const concept = fromFrame ?? concepts.find((c) => c.id === last) ?? concepts[0];
      if (!concept) {
        toast("Create a concept first (left panel, New concept).");
        return;
      }
      const result = await run(() =>
        createEntityAction(workspaceId, {
          conceptId: concept.id,
          ...(name ? { name } : {}),
          // with its height the new card joins the frame it lands in (slice 2b)
          placement: { canvasId, x: snap8(at.x), y: snap8(at.y), height: newCardHeight(0), frames: ui.frameRefs() },
        }),
      );
      if (!result.ok) return;
      panels.setLastConcept(concept.id);
      const cardId = result.value.canvasItemId;
      if (cardId) ui.select({ t: "card", id: cardId });
      if (name) toast(`Created ${result.value.name} in ${concept.name}.`);
      else {
        toast(`Created ${result.value.name} in ${concept.name}. Type its name now; change the concept in the panel.`);
        if (cardId) panels.setNameFocus(cardId);
      }
    },
    [editable, ix, panels, toast, run, workspaceId, canvasId, ui],
  );

  const relate = useCallback(
    async (fromCardId: Uuid, toCardId: Uuid) => {
      if (!editable) return;
      const from = cardById.get(fromCardId), to = cardById.get(toCardId);
      if (from?.kind !== "ent" || to?.kind !== "ent") return;
      if (from.id === to.id) {
        toast("Pick a different entity to relate to.");
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

  /** Deletes a mapping or a relationship at once; the toast offers Undo (slice 1b). */
  const deleteLine = useCallback(
    async (line: { t: "map" | "rel"; id: Uuid }) => {
      if (!editable) return;
      if (line.t === "map") {
        const m = ix.mapping.get(line.id);
        if (!m) return;
        const r = await run(() => deleteMappingAction(workspaceId, { mappingId: m.id, expectedVersion: m.version }), "Mapping deleted", { undoable: true });
        if (r.ok) ui.select(null);
      } else {
        const rel = ix.model.relationships.find((x) => x.id === line.id);
        if (!rel) return;
        const r = await run(() => deleteRelationshipAction(workspaceId, { relationshipId: rel.id, expectedVersion: rel.version }), "Relationship deleted", {
          undoable: true,
        });
        if (r.ok) ui.select(null);
      }
    },
    [editable, ix, run, workspaceId, ui],
  );

  useEffect(() => {
    ui.registerHost({
      dropColumn: columns.dropColumn,
      createEntityAt: (at, name) => void createEntityAt(at, name),
      relate: (from, to) => void relate(from, to),
      openToolbox: setToolbox,
      moveAttribute: (attributeId, how) => {
        if (editable) void moveAttribute(attributeId, how);
      },
      deleteLine: (line) => void deleteLine(line),
      frameCreated: (frameId) => panels.setNameFocus(frameId),
    });
    return () => ui.registerHost(null);
  }, [ui, columns.dropColumn, createEntityAt, relate, moveAttribute, editable, deleteLine, panels]);

  // ---- the toolbox ----

  const cardItems = (card: HostCard): ToolboxItem[] => {
    const items: ToolboxItem[] = [];
    const isEnt = card.kind === "ent";
    // What the canvas shows now: a collapse or filter is saved without a fresh page.
    const view = ui.cardView(card.id) ?? card;
    if (editable) {
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
    }
    if (editable) {
      items.push({
        seg: "Rows",
        options: FILTER_ORDER.map((f) => ({ label: FILTER_LABEL[f], on: view.rowFilter === f, act: () => ui.setCardView(card.id, { rowFilter: f }) })),
      });
      items.push({ label: view.collapsed ? "Expand card" : "Collapse card", act: () => ui.setCardView(card.id, { collapsed: !view.collapsed }) });
      items.push({ label: "Fit width to names", act: () => ui.fitWidth(card.id) });
      if (!ui.cardFrame(card.id)) {
        items.push({ label: `Put in a new ${isEnt ? "concept" : "source system"} frame`, act: () => ui.putInNewFrame([card.id], true) });
      }
      items.push({ sep: true });
      items.push({ label: "Remove from this canvas", danger: true, act: () => ui.remove(card.id) });
      if (isEnt) items.push({ label: "Delete from model…", danger: true, act: () => setDeleting(card.targetId) });
    }
    return items;
  };

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
    if (name && !ix.model.entities.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      found.unshift({
        key: "new",
        label: `Create entity “${name}”`,
        meta: "new entity",
        kind: "new",
        here: false,
        pick: () => toolbox && void createEntityAt({ x: toolbox.at.x - 24, y: toolbox.at.y - 20 }, name),
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
        items.push({ label: "New entity here", kbd: "E", act: () => void createEntityAt({ x: req.at.x - 24, y: req.at.y - 20 }) });
        items.push({ label: "New frame here", kbd: "A", act: () => ui.createFrameAt(req.at) });
      }
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
            act: () => void run(() => setMappingStatusAction(workspaceId, { mappingId: m.id, expectedVersion: m.version, status })),
          });
        }
      }
      if (editable) {
        items.push({ sep: true });
        items.push({ label: "Edit transformation rule…", act: () => panels.setRuleFocus(m.id) });
        if ((ix.inputsOf.get(m.id) ?? []).length > 1) {
          items.push({
            label: "Split into separate mappings",
            act: () =>
              void run(
                () => splitMappingAction(workspaceId, { mappingId: m.id, expectedVersion: m.version }),
                (v) => v.notice ?? `Split into ${v.mappings} separate mappings.`,
              ),
          });
        }
        if ((ix.mappingsOf.get(m.attribute_id) ?? []).length > 1) {
          items.push({ label: "Merge mappings…", act: () => panels.setMergeFocus(m.id) });
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
    if (t.kind === "rel") {
      const r = ix.model.relationships.find((x) => x.id === t.relationshipId);
      if (!r) return items;
      items.push({ head: `${ix.entity.get(r.from_entity_id)?.name ?? "?"} – ${ix.entity.get(r.to_entity_id)?.name ?? "?"}` });
      if (editable) {
        const ref = { relationshipId: r.id, expectedVersion: r.version };
        items.push({ label: "Edit name and cardinality…", act: () => focusField("f-rl") });
        items.push({ label: "Swap direction", act: () => void run(() => swapRelationshipAction(workspaceId, ref)) });
        items.push({
          label: "Delete relationship",
          danger: true,
          kbd: "Del",
          act: () => void deleteLine({ t: "rel", id: r.id }),
        });
      }
      return items;
    }
    if (t.kind === "selection") {
      // a group (slice 2a; prototype ctxFor “a group”): reviewers and readers only clear it
      const sel = ui.selection;
      const keys = sel?.t === "multi" ? sel.keys : [];
      // frames stand for their cards (slice 2b): fit widths, put in a new frame and remove act on the selected cards
      const cardKeys = keys.filter((k) => !isFrameKey(k));
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
        if (keys.some((k) => k.startsWith("entity:"))) {
          items.push({ label: "Add sources of selected entities", act: () => ui.placeSourcesOfSelection((id) => feedingSourceCards(ix, id)) });
        }
        if (cardKeys.length) items.push({ label: "Remove from this canvas", danger: true, act: () => ui.removeSelection() });
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
      if (editable) items.push({ label: "Rename…", act: () => focusField("f-fn"), testId: "toolbox-frame-rename" });
      // slice 2c (D-07): collapse into one block or expand; a block offers no fit, and its cards are not selectable
      if (editable) {
        items.push({ label: collapsed ? "Expand" : "Collapse into one block", act: () => ui.setFrameCollapsed(t.frameId, !collapsed), testId: "toolbox-frame-collapse" });
      }
      if (editable && !collapsed) items.push({ label: "Fit frame to its content", act: () => ui.fitFrame(t.frameId), testId: "toolbox-frame-fit" });
      items.push({ label: "Select its cards", disabled: collapsed || !view.cardIds.length, act: () => ui.selectFrameCards(t.frameId), testId: "toolbox-frame-select-cards" });
      items.push({ label: "Zoom to frame", act: () => ui.zoomToFrame(t.frameId), testId: "toolbox-frame-zoom" });
      if (editable) {
        items.push({ sep: true });
        items.push({ label: "Delete frame (keeps its cards)", kbd: "Del", danger: true, act: () => ui.deleteFrame(t.frameId), testId: "toolbox-frame-delete" });
      }
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
          items.push({ label: "Map from a column…", act: () => focusField("f-addc") });
          items.push({ sep: true });
          // the same confirmation as in the attribute panel: with mappings it asks for a second click
          const n = (ix.mappingsOf.get(a.id) ?? []).length;
          items.push({
            label: "Delete attribute",
            danger: true,
            ...(n ? { confirm: `Click again to delete, with ${n} mapping${n > 1 ? "s" : ""}` } : {}),
            act: () =>
              void run(
                () => deleteAttributeAction(workspaceId, { attributeId: a.id, expectedVersion: a.version }),
                `Attribute deleted${n ? ` together with ${n} mapping${n > 1 ? "s" : ""}` : ""}`,
                { undoable: true },
              ).then((r) => {
                if (r.ok) ui.select(null);
              }),
          });
        }
      }
      return items;
    }
    if (t.kind === "row" && card.kind === "src" && ix.column.has(t.rowId)) {
      items.push({ head: columnLabel(ix, t.rowId) });
      if (editable) items.push({ label: "Map to an attribute…", act: () => focusField("f-adda") });
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
    </>
  );

  return { elements, mapColumn: columns.mapColumn, pendingInput: columns.pendingInput, clearPendingInput: columns.clearPendingInput };
}
