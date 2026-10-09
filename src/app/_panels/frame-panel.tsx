"use client";

// The frame panel (slice 2b, PRD item 9; prototype insFrame): name; what the frame stands for (free area, concept,
// source system) with the concept or system, or a free frame's colour; what that means; its cards; how far they are
// mapped; what does not belong there (an entity of another concept can be moved to the frame's concept); zoom, fit,
// delete. It shows the frame as the canvas has it now and draws again when the canvas changes the frame or its cards
// (`layoutKey`). Changing what the frame stands for never moves cards or changes the model.

import { useContext, useEffect, useRef } from "react";
import { updateEntityAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx, type FramePatch } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { FREE_FRAME_COLORS } from "@/domain/model/frames";
import type { FrameKind } from "@/domain/types";
import { Actions, buttonClass, dangerClass, Field, inputClass, Kind, Li, List, Section, Seg, smallButtonClass, TextField } from "./fields";
import { usePanel } from "./inspector";
import { usePanels } from "./panels-context";

const KINDS = [
  ["free", "Free area"],
  ["concept", "Concept"],
  ["source_system", "Source system"],
] as const;

const EXPLAIN: Record<FrameKind, string> = {
  free: "A free area only organises this canvas. It says nothing about the model.",
  concept: "Mirrors a concept in the model. Dropping an entity from another concept here asks whether to move it.",
  source_system: "Mirrors a source system. Tables from other systems are flagged.",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function FramePanel({ frameId }: { frameId: Uuid }) {
  const ui = useContext(CanvasUiCtx);
  const p = usePanel();
  const { run } = useAction();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const view = ui.frameView(frameId);

  useEffect(() => {
    if (nameFocus !== frameId) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, frameId, setNameFocus]);

  if (!view) return null;
  const { frame: f, members, stats } = view;
  const ix = p.ix;
  const update = (patch: FramePatch) => void ui.updateFrame(f.id, patch);

  /** What the frame stands for when switched to a kind: from its cards first, as in the prototype. */
  const switchTo = (kind: FrameKind) => {
    if (kind === "free") return update({ kind });
    if (kind === "concept") {
      const fromCards = members.map((m) => (m.kind === "ent" ? ix.entity.get(m.targetId)?.concept_id : undefined)).find(Boolean);
      const conceptId = fromCards ?? [...ix.model.concepts].sort((a, b) => a.sort_order - b.sort_order)[0]?.id;
      return conceptId && update({ kind, conceptId });
    }
    const fromCards = members.map((m) => (m.kind === "src" ? ix.table.get(m.targetId)?.source_system_id : undefined)).find(Boolean);
    const sourceSystemId = fromCards ?? ix.model.sourceSystems[0]?.id;
    return sourceSystemId && update({ kind, sourceSystemId });
  };

  const goCard = (cardId: Uuid) => {
    ui.select({ t: "card", id: cardId });
    ui.centerOn(cardId);
  };

  const frameConcept = f.conceptId ? ix.model.concepts.find((c) => c.id === f.conceptId) : undefined;
  const moveToFrameConcept = (entityId: Uuid) => {
    const e = ix.entity.get(entityId);
    if (!e || !frameConcept) return;
    void run(() => updateEntityAction(p.workspaceId, { entityId: e.id, expectedVersion: e.version, conceptId: frameConcept.id }), `${e.name} now belongs to ${frameConcept.name}.`, {
      undoable: true,
    });
  };

  const misplaced = members.filter((m) => m.misplaced);
  const counts = [
    stats.attributes ? `${stats.mapped} of ${stats.attributes} attributes mapped.` : "",
    stats.columns ? `${stats.used} of ${stats.columns} columns used.` : "",
    stats.typeProblems ? `${plural(stats.typeProblems, "type problem")}.` : "",
    stats.drafts ? `${plural(stats.drafts, "draft mapping")}.` : "",
  ].filter(Boolean);

  return (
    <div data-testid="panel-frame">
      <Kind>Frame on this canvas</Kind>
      <Field label="Name" htmlFor="f-fn">
        <TextField
          key={`${f.id}:${f.version}`}
          id="f-fn"
          value={f.name}
          required
          readOnly={!p.editable}
          onSave={(name) => update({ name })}
          testId="input-frame-name"
          inputRef={nameRef}
        />
      </Field>
      <Field label="Stands for">
        <Seg value={f.kind} options={KINDS} onChange={switchTo} disabled={!p.editable} testId="seg-frame-kind" />
      </Field>
      {f.kind === "concept" && (
        <Field label="Concept" htmlFor="f-fr">
          <select
            key={`${f.id}:${f.version}`}
            id="f-fr"
            className={inputClass}
            defaultValue={f.conceptId ?? ""}
            disabled={!p.editable}
            data-testid="select-frame-concept"
            onChange={(e) => update({ conceptId: e.target.value })}
          >
            {[...ix.model.concepts]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      {f.kind === "source_system" && (
        <Field label="Source system" htmlFor="f-fr">
          <select
            key={`${f.id}:${f.version}`}
            id="f-fr"
            className={inputClass}
            defaultValue={f.sourceSystemId ?? ""}
            disabled={!p.editable}
            data-testid="select-frame-system"
            onChange={(e) => update({ sourceSystemId: e.target.value })}
          >
            {ix.model.sourceSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {f.kind === "free" && (
        <Field label="Colour">
          <div className="flex gap-1.5" role="group" data-testid="swatches-frame-color">
            {FREE_FRAME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === f.color}
                aria-label={`Colour ${c}`}
                disabled={!p.editable}
                onClick={() => c !== f.color && update({ color: c })}
                className="size-[22px] rounded-md shadow-[0_0_0_1px_var(--im-line)] aria-pressed:shadow-[0_0_0_2px_var(--im-surface),0_0_0_3.5px_var(--im-ink)]"
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      )}
      <p className="mt-3 text-im-ink-2" data-testid="text-frame-kind">
        {EXPLAIN[f.kind]}
      </p>

      <Section>In this frame</Section>
      {members.length ? (
        <List testId="list-frame-cards">
          {members.map((m) => (
            <Li key={m.id} meta={m.kind === "ent" ? "entity" : "table"} onClick={() => goCard(m.id)} testId="frame-card">
              <span className={m.kind === "src" ? "font-mono text-xs" : ""}>{m.name}</span>
            </Li>
          ))}
        </List>
      ) : (
        <p className="text-im-ink-2" data-testid="text-frame-empty">
          Empty. Drag cards into the frame.
        </p>
      )}
      {counts.length > 0 && (
        <p className="mt-2 text-im-ink-2" data-testid="text-frame-counts">
          {counts.join(" ")}
        </p>
      )}

      {misplaced.length > 0 && (
        <>
          <Section>Doesn&apos;t belong here</Section>
          <List testId="list-frame-misplaced">
            {misplaced.map((m) => {
              const entity = m.kind === "ent" ? ix.entity.get(m.targetId) : undefined;
              if (entity && f.kind === "concept") {
                const now = ix.model.concepts.find((c) => c.id === entity.concept_id)?.name ?? "–";
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5" data-testid="frame-misplaced">
                    <span className="min-w-0 flex-1 truncate">
                      {entity.name} <span className="text-[11.5px] text-im-ink-3">is in {now}</span>
                    </span>
                    {p.editable && frameConcept && (
                      <button type="button" className={smallButtonClass} onClick={() => moveToFrameConcept(entity.id)} data-testid="button-frame-move-entity">
                        Move to {frameConcept.name}
                      </button>
                    )}
                  </div>
                );
              }
              const table = m.kind === "src" ? ix.table.get(m.targetId) : undefined;
              const meta = table ? `system ${ix.model.sourceSystems.find((s) => s.id === table.source_system_id)?.name ?? "?"}` : "entity, not a table";
              return (
                <Li key={m.id} meta={meta} testId="frame-misplaced">
                  <span className={m.kind === "src" ? "font-mono text-xs" : ""}>{m.name}</span>
                </Li>
              );
            })}
          </List>
        </>
      )}

      <Actions>
        {/* every role: reviewers and readers collapse and expand in their own tab only (slice 2c, item 11) */}
        <button type="button" className={buttonClass} onClick={() => ui.setFrameCollapsed(f.id, !f.collapsed)} data-testid="button-frame-collapse">
          {f.collapsed ? "Expand frame" : "Collapse frame"}
        </button>
        <button type="button" className={buttonClass} onClick={() => ui.zoomToFrame(f.id)} data-testid="button-frame-zoom">
          Zoom to frame
        </button>
        {p.editable && !f.collapsed && (
          <button type="button" className={buttonClass} onClick={() => ui.fitFrame(f.id)} data-testid="button-frame-fit">
            Fit frame to its content
          </button>
        )}
        {p.editable && (
          <button type="button" className={dangerClass} onClick={() => ui.deleteFrame(f.id)} data-testid="button-frame-delete">
            Delete frame
          </button>
        )}
      </Actions>
      <p className="mt-2 text-xs text-im-ink-3">Deleting a frame keeps everything inside it on the canvas.</p>
    </div>
  );
}
