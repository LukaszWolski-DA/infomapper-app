"use client";

// Mapping a column to an attribute from the canvas or the column panel (slice 1b, D-48). A column dropped on an
// attribute row, or picked in “Map to an attribute”, becomes a direct mapping; if the attribute already has mappings,
// a small choice opens at the drop point: “Separate mapping (alternative source)” or “Add to mapping …”, pre-selected
// by the hint (`planMapColumn`). Keyboard first: ↑/↓ choose, Enter confirms, Esc cancels. Adding to a mapping without
// a rule opens the mapping panel with the column waiting for its rule (the 1a rule for a second input).
// A column dropped elsewhere on an entity card becomes a new attribute with its mapping (prototype createAttrFromCol).

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAttributeFromColumnAction } from "@/app/_actions/model";
import { addMappingInputAction, createMappingAction } from "@/app/_actions/mapping";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, type ColumnDrop } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { planMapColumn, type MappingChoice } from "@/domain/model/mapping-choice";
import { checkColumnType } from "@/domain/model/type-check";
import { useToast } from "@/ui/components/toast";
import { attributeLabel, columnLabel, inputsLabel, type ModelIndex } from "./model-index";

/** A column picked as a further input of a mapping, waiting in the mapping panel for its rule. */
export interface PendingInput {
  mappingId: Uuid;
  columnId: Uuid;
}

interface Choice {
  columnId: Uuid;
  attributeId: Uuid;
  options: MappingChoice[];
  preselected: number;
  at: { x: number; y: number };
}

export function useMapColumn({ ix, workspaceId, editable, cardOf }: { ix: ModelIndex; workspaceId: string; editable: boolean; cardOf: (targetId: Uuid) => Uuid | null }) {
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const toast = useToast();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);

  const createDirect = useCallback(
    async (columnId: Uuid, attributeId: Uuid) => {
      const attribute = ix.attribute.get(attributeId), column = ix.column.get(columnId);
      const fits = !attribute || !column || checkColumnType(attribute, column).ok;
      const result = await run(
        () => createMappingAction(workspaceId, { attributeId, sourceColumnId: columnId }),
        `Mapped ${columnLabel(ix, columnId)} to ${attributeLabel(ix, attributeId)}${fits ? "" : ". The data types don't fit."}`,
      );
      if (result.ok) ui.select({ t: "map", id: result.value.mappingId });
    },
    [ix, run, workspaceId, ui],
  );

  /** Maps a column to an attribute: directly, by selecting the existing mapping, or after the choice. */
  const mapColumn = useCallback(
    (columnId: Uuid, attributeId: Uuid, at: { x: number; y: number }) => {
      const column = ix.column.get(columnId);
      if (!column || !ix.attribute.has(attributeId)) return;
      const mappings = ix.mappingsOf.get(attributeId) ?? [];
      const plan = planMapColumn(column, mappings, mappings.flatMap((m) => ix.inputsOf.get(m.id) ?? []), (id) => ix.column.get(id));
      if (plan.kind === "create") void createDirect(columnId, attributeId);
      else if (plan.kind === "exists") {
        ui.select({ t: "map", id: plan.mappingId });
        toast("That mapping already exists. It is selected now.");
      } else setChoice({ columnId, attributeId, options: plan.options, preselected: plan.preselected, at });
    },
    [ix, createDirect, ui, toast],
  );

  const confirm = useCallback(
    (c: Choice, option: MappingChoice) => {
      setChoice(null);
      if (option.kind === "separate") {
        void createDirect(c.columnId, c.attributeId);
        return;
      }
      const mapping = ix.mapping.get(option.mappingId);
      if (!mapping) return;
      if (mapping.rule_expression?.trim()) {
        void run(() => addMappingInputAction(workspaceId, { mappingId: mapping.id, expectedVersion: mapping.version, sourceColumnId: c.columnId })).then(
          (r) => {
            if (!r.ok) return;
            ui.select({ t: "map", id: mapping.id });
            toast(r.value.notice ?? `Added ${columnLabel(ix, c.columnId)} to the mapping.`);
          },
        );
        return;
      }
      setPendingInput({ mappingId: mapping.id, columnId: c.columnId });
      ui.select({ t: "map", id: mapping.id });
    },
    [ix, createDirect, run, workspaceId, ui, toast],
  );

  /** A column dropped on an entity card but not on a row: a new attribute mapped from it (or the one of that name). */
  const dropOnEntity = useCallback(
    async (columnId: Uuid, entityId: Uuid) => {
      const result = await run(() => createAttributeFromColumnAction(workspaceId, { entityId, sourceColumnId: columnId }));
      if (!result.ok) return;
      const { attributeId, mappingId, createdAttribute } = result.value;
      const column = ix.column.get(columnId);
      if (createdAttribute) {
        const card = cardOf(entityId);
        if (card) ui.select({ t: "row", cardId: card, id: attributeId });
        toast(`Added ${column?.name ?? "the attribute"} to ${ix.entity.get(entityId)?.name ?? "the entity"}, mapped from ${columnLabel(ix, columnId)}. Rename it on the right.`);
      } else {
        ui.select({ t: "map", id: mappingId });
        toast(`Mapped ${columnLabel(ix, columnId)} to ${attributeLabel(ix, attributeId)}`);
      }
    },
    [ix, run, workspaceId, cardOf, ui, toast],
  );

  /** A column dropped on the canvas: on an attribute row, or elsewhere on an entity card. */
  const dropColumn = useCallback(
    (drop: ColumnDrop) => {
      if (!editable) return;
      if ("attributeId" in drop.target) mapColumn(drop.columnId, drop.target.attributeId, drop.at);
      else void dropOnEntity(drop.columnId, drop.target.entityId);
    },
    [editable, mapColumn, dropOnEntity],
  );

  // On the body: the right panel may be hidden on a narrow screen while the canvas is in use.
  const choiceElement = choice
    ? createPortal(
        <MapChoice key={`${choice.columnId}:${choice.attributeId}`} choice={choice} ix={ix} onConfirm={(o) => confirm(choice, o)} onCancel={() => setChoice(null)} />,
        document.body,
      )
    : null;

  return { mapColumn, dropColumn, choiceElement, pendingInput, clearPendingInput: useCallback(() => setPendingInput(null), []) };
}

function MapChoice({ choice, ix, onConfirm, onCancel }: { choice: Choice; ix: ModelIndex; onConfirm: (o: MappingChoice) => void; onCancel: () => void }) {
  const [active, setActive] = useState(choice.preselected);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(choice.at);

  // Keep the popover on the screen, next to the drop point.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(choice.at.x + 8, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(choice.at.y + 8, window.innerHeight - r.height - 8)),
    });
    el.focus();
  }, [choice.at]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [onCancel]);

  const label = (o: MappingChoice) => (o.kind === "separate" ? "Separate mapping (alternative source)" : `Add to mapping ${inputsLabel(ix, o.mappingId)}`);

  return (
    <div
      ref={box}
      role="listbox"
      tabIndex={-1}
      aria-label={`Map ${columnLabel(ix, choice.columnId)} to ${attributeLabel(ix, choice.attributeId)}`}
      aria-activedescendant={`map-choice-${active}`}
      data-testid="popover-map-choice"
      className="fixed z-50 w-[300px] rounded-lg border border-im-line bg-im-surface p-1.5 text-[13px] shadow-lg outline-none"
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = choice.options.length;
          setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        } else if (e.key === "Enter") {
          e.preventDefault();
          onConfirm(choice.options[active]!);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="px-2 pb-1 pt-0.5 text-[11.5px] text-im-ink-3">
        {attributeLabel(ix, choice.attributeId)} already has a mapping. Map <span className="font-mono">{columnLabel(ix, choice.columnId)}</span> as:
      </div>
      {choice.options.map((o, i) => (
        <div
          key={o.kind === "separate" ? "separate" : o.mappingId}
          id={`map-choice-${i}`}
          role="option"
          aria-selected={i === active}
          data-testid="option-map-choice"
          className={`cursor-pointer truncate rounded-md px-2 py-1.5 ${i === active ? "bg-im-logical-soft text-im-logical" : "hover:bg-im-hover"}`}
          onPointerEnter={() => setActive(i)}
          onClick={() => onConfirm(o)}
        >
          {label(o)}
        </div>
      ))}
      <div className="px-2 pb-0.5 pt-1 text-[11px] text-im-ink-3">Enter confirms, Esc cancels</div>
    </div>
  );
}
