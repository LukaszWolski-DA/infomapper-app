"use client";

// The Requirements section of the entity, attribute, mapping, source table and column panels (slice 4a, PRD items
// 28–29, prototype reqSection, D-34 panel part): the requirements linked to the element, with × to unlink, then those
// that reach it indirectly (slice 4b-1, PRD item 12: “via attribute”, “via mapping”, “via column”; no “via entity”),
// without ×. A click opens the requirement's panel. Slice 4b-2 (items 14–15), for those who may edit: each row's “Place
// card” icon places the requirement's card next to the element (or selects its card when it is here and brings it into
// view); a row dragged onto the canvas places the card where it is dropped (never a link); “Add all to this canvas” or
// “Add the {n} missing to this canvas” under the list. Below, for those who may edit (slice 17, D-72): “Link to
// requirements…” opens a picker that links several at once (one undo step), the linked ones checked and disabled, with
// “New requirement…” in its footer, which creates a requirement linked to this element and opens it with its name
// selected; an entity's panel also has “Link all attributes…”: each live attribute linked to each chosen requirement,
// existing links skipped. Read from the requirement index, never computed while rendering.

import { useContext, type DragEvent } from "react";
import { createRequirementAction, linkRequirementsAction, unlinkRequirementAction } from "@/app/_actions/requirement";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, REQ_CARD_DRAG_TYPE } from "@/canvas/context";
import { marks } from "@/domain/model/labels";
import type { TraceTarget } from "@/domain/model/requirements";
import type { Requirement } from "@/domain/types";
import { openPick } from "@/ui/pick-popover";
import { Fold, Hint, List, smallButtonClass } from "./fields";
import { usePanel } from "./inspector";
import { usePanels } from "./panels-context";
import { KindIcon } from "./requirement-ui";

/** The name field a requirement panel focuses after “+ New requirement…” (`usePanels().nameFocus`). */
export const requirementNameFocus = (requirementId: string) => `req:${requirementId}`;

export function RequirementsSection({ target }: { target: TraceTarget }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const { setNameFocus } = usePanels();
  const { direct, indirect } = p.rx.of(target);
  const linked = new Set(direct.map((r) => r.id));
  const attributes = target.kind === "entity" ? (p.ix.attributesOf.get(target.id) ?? []) : [];
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
  const newRequirement = async () => {
    const result = await run(() => createRequirementAction(p.workspaceId, { link: target }));
    if (result.ok) {
      setNameFocus(requirementNameFocus(result.value.requirementId));
      p.goRequirement(result.value.requirementId);
    }
  };
  // the picker under its button (prototype openReqPick); `all`: "Link all attributes…" of this entity
  const openPicker = (button: HTMLElement, all: boolean) => {
    const r = button.getBoundingClientRect();
    const entityName = all ? (p.ix.model.entities.find((e) => e.id === target.id)?.name ?? "") : "";
    openPick({
      at: { x: r.left, y: r.bottom + 4 },
      multi: true,
      title: all ? `Link all ${attributes.length} attributes of ${entityName} to…` : "Link to requirements",
      note: all ? "Attributes already linked to a chosen requirement are skipped." : undefined,
      placeholder: "Type to filter requirements…",
      empty: "No requirements yet.",
      doneTitle: "Already linked",
      items: p.rx.requirements.map((q) => ({ id: q.id, key: q.key, label: q.name, done: !all && linked.has(q.id) })),
      confirm: (n) => (all ? (n ? `Link to ${n}` : "Link") : n ? `Link ${n}` : "Link"),
      extra: all ? undefined : { label: "New requirement…", act: () => void newRequirement() },
      testId: all ? "picker-link-all" : "picker-requirements",
      pick: (requirementIds) =>
        void run(
          () =>
            linkRequirementsAction(p.workspaceId, {
              requirementIds,
              targets: all ? attributes.map((a) => ({ kind: "attribute" as const, id: a.id })) : [target],
              ...(all ? { allOf: { entityId: target.id } } : {}),
            }),
          (v) => v.message,
          { undoable: true },
        ),
    });
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
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            id={`f-req-${target.kind}`}
            data-pop=""
            className={smallButtonClass}
            data-testid="button-link-requirements"
            onClick={(e) => openPicker(e.currentTarget, false)}
          >
            Link to requirements…
          </button>
          {target.kind === "entity" && attributes.length > 0 && (
            <button
              type="button"
              className={smallButtonClass}
              title="Link chosen requirements to each attribute of this entity"
              data-testid="button-link-all-attributes"
              onClick={(e) => openPicker(e.currentTarget, true)}
            >
              Link all attributes…
            </button>
          )}
        </div>
      )}
    </Fold>
  );
}
