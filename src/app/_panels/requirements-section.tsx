"use client";

// The Requirements section of the entity, attribute, mapping, source table and column panels (slice 4a, PRD items
// 28–29, prototype reqSection, D-34 panel part): the requirements linked to the element, with × to unlink, then those
// that reach it indirectly (slice 4b-1, PRD item 12: “via attribute”, “via mapping”, “via column”; no “via entity”),
// without ×. A click opens the requirement's panel. Slice 4b-2 (items 14–15), for those who may edit: each row's “Place
// card” icon places the requirement's card next to the element (or selects its card when it is here and brings it into
// view); a row dragged onto the canvas places the card where it is dropped (never a link); “Add all to this canvas” or
// “Add the {n} missing to this canvas” under the list. Below, for those who may edit: “Link to a requirement…”,
// with “+ New requirement…” at the end, which creates a requirement linked to this element and opens it with its name
// selected. Read from the requirement index, never computed while rendering.

import { useContext, type DragEvent } from "react";
import { createRequirementAction, linkRequirementAction, unlinkRequirementAction } from "@/app/_actions/requirement";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, REQ_CARD_DRAG_TYPE } from "@/canvas/context";
import { marks } from "@/domain/model/labels";
import type { TraceTarget } from "@/domain/model/requirements";
import type { Requirement } from "@/domain/types";
import { Field, Fold, Hint, inputClass, List, smallButtonClass } from "./fields";
import { usePanel } from "./inspector";
import { usePanels } from "./panels-context";
import { KindIcon } from "./requirement-ui";

const NEW = "__new__";

/** The name field a requirement panel focuses after “+ New requirement…” (`usePanels().nameFocus`). */
export const requirementNameFocus = (requirementId: string) => `req:${requirementId}`;

export function RequirementsSection({ target }: { target: TraceTarget }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const { setNameFocus } = usePanels();
  const { direct, indirect } = p.rx.of(target);
  const linked = new Set(direct.map((r) => r.id));
  const available = p.rx.requirements.filter((r) => !linked.has(r.id));
  // the requirements listed, each once, and those whose card is not on this canvas (ui changes with the canvas's layout)
  const listed = [...direct, ...indirect.map((x) => x.requirement)].filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
  const missing = listed.filter((r) => !ui.requirementCard(r.id));
  const placeCard = (r: Requirement) => (ui.requirementCard(r.id) ? ui.showRequirementCard(r.id) : ui.placeRequirementCardsBeside([r.id], target));
  const onDragStart = (r: Requirement) => (e: DragEvent) => {
    e.dataTransfer.setData(REQ_CARD_DRAG_TYPE, JSON.stringify({ requirementId: r.id, key: r.key }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const unlink = (r: Requirement) => {
    const link = p.rx.linksOf(r.id).find((k) => marks(k, target));
    if (link) void run(() => unlinkRequirementAction(p.workspaceId, { requirementLinkId: link.id, expectedVersion: link.version }), "Unlinked.", { undoable: true });
  };
  const pick = async (value: string) => {
    if (value === NEW) {
      const result = await run(() => createRequirementAction(p.workspaceId, { link: target }));
      if (result.ok) {
        setNameFocus(requirementNameFocus(result.value.requirementId));
        p.goRequirement(result.value.requirementId);
      }
      return;
    }
    await run(() => linkRequirementAction(p.workspaceId, { requirementId: value, target }), (v) => v.message, { undoable: true });
  };

  const row = (r: Requirement, viaText: string | null) => (
    <div
      key={`${r.id}:${viaText ?? "direct"}`}
      className="flex items-center gap-1 rounded-md hover:bg-im-hover"
      data-testid="item-requirement"
      data-via={viaText ?? undefined}
      data-key={r.key}
      data-on-canvas={ui.requirementCard(r.id) ? "true" : undefined}
      draggable={p.editable || undefined}
      onDragStart={p.editable ? onDragStart(r) : undefined}
    >
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left" onClick={() => p.goRequirement(r.id)} title="Click to open the requirement.">
        <span className="flex flex-none items-center gap-1 text-im-req">
          <KindIcon kind={r.kind} />
          <span className="font-mono text-[11.5px]">{r.key}</span>
        </span>
        <span className="min-w-0 flex-1 truncate">{r.name}</span>
        {viaText && <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{viaText}</span>}
      </button>
      {p.editable && (
        <button
          type="button"
          className="grid size-6 flex-none place-items-center rounded text-im-req hover:bg-im-surface"
          aria-label={`Place ${r.key}'s card`}
          title={ui.requirementCard(r.id) ? "Its card is on this canvas: show it" : "Place its card next to this element (or drag the row onto the canvas)"}
          onClick={() => placeCard(r)}
          data-testid="button-requirement-place"
        >
          <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.5]" aria-hidden>
            <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
            <path d="M2.5 6.5h11" />
          </svg>
        </button>
      )}
      {!viaText && p.editable && (
        <button
          type="button"
          className="mr-1 grid size-6 flex-none place-items-center rounded text-im-ink-3 hover:bg-im-surface hover:text-im-warn"
          aria-label={`Unlink ${r.key}`}
          title="Unlink"
          onClick={() => unlink(r)}
          data-testid="button-requirement-unlink"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <Fold title="Requirements" count={direct.length + indirect.length} testId="section-requirements">
      {direct.length + indirect.length ? (
        <List testId="list-requirements">
          {direct.map((r) => row(r, null))}
          {indirect.map(({ requirement, via }) => row(requirement, via))}
        </List>
      ) : (
        <Hint>Not linked to any requirement yet.</Hint>
      )}
      {p.editable && missing.length > 0 && (
        <div className="mt-1.5">
          <button type="button" className={smallButtonClass} onClick={() => ui.placeRequirementCardsBeside(missing.map((r) => r.id), target)} data-testid="button-requirements-add-all">
            {missing.length === listed.length ? "Add all to this canvas" : `Add the ${missing.length} missing to this canvas`}
          </button>
        </div>
      )}
      {p.editable && (
        <Field label="Link to a requirement" htmlFor={`f-req-${target.kind}`}>
          <select
            id={`f-req-${target.kind}`}
            value=""
            className={inputClass}
            data-testid="select-link-requirement"
            onChange={(e) => e.target.value && void pick(e.target.value)}
          >
            <option value="">Link to a requirement…</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {`${r.key}  ${r.name}`}
              </option>
            ))}
            <option value={NEW}>+ New requirement…</option>
          </select>
        </Field>
      )}
    </Fold>
  );
}
