"use client";

// The entity panel (prototype insEntity): name (focused right after “+”, D-46), stereotype, concept, definition
// (plain text, AD-30), attributes with their sources and “Add attribute”, feeding sources (placed beside the card,
// “Add the N missing to this canvas”, B-08), relationships,
// “Remove from this canvas” and “Delete from model…” with the impact dialog (D-47).

import { useContext, useEffect, useRef, useState } from "react";
import { addAttributeAction, updateEntityAction } from "@/app/_actions/model";
import type { UpdateEntityInput } from "@/domain/commands/entity";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { STEREOTYPES, type Entity, type Stereotype } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { DeleteEntityDialog } from "./delete-entity-dialog";
import { Actions, buttonClass, dangerClass, Field, Fold, Hint, inputClass, Li, LongList, smallButtonClass, TextArea, TextField } from "./fields";
import { usePanel } from "./inspector";
import { OnCanvases } from "./on-canvases";
import { CardFrame } from "./card-frame";
import { useMoveAttribute } from "./move-attribute";
import { feedingSources, inputsLabel } from "./model-index";
import { usePanels } from "./panels-context";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function EntityPanel({ entity: e, cardId }: { entity: Entity; cardId: Uuid }) {
  const p = usePanel();
  const move = useMoveAttribute(p.ix, p.workspaceId);
  /** Dragging in the attribute list: which attribute, and where it would go. */
  const [order, setOrder] = useState<{ dragging: string | null; over: { id: string; after: boolean } | null }>({ dragging: null, over: null });
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const toast = useToast();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const ix = p.ix;
  const attributes = ix.attributesOf.get(e.id) ?? [];
  const feeds = feedingSources(ix, e.id);
  /** Feeding sources not on this canvas, to place on the left of the card (B-08). */
  const missing = feeds.filter((f) => !p.cardOf(f.table.id)).map((f) => ({ target: { sourceTableId: f.table.id }, rows: (ix.columnsOf.get(f.table.id) ?? []).length }));
  const relationships = ix.model.relationships.filter((r) => r.from_entity_id === e.id || r.to_entity_id === e.id);

  useEffect(() => {
    if (nameFocus !== cardId) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, cardId, setNameFocus]);

  async function save(change: Omit<UpdateEntityInput, "entityId" | "expectedVersion">) {
    const result = await run(() => updateEntityAction(p.workspaceId, { entityId: e.id, expectedVersion: e.version, ...change }));
    if (result.ok && result.value.warning) toast(result.value.warning);
  }

  async function addAttribute() {
    const result = await run(() => addAttributeAction(p.workspaceId, { entityId: e.id }));
    if (result.ok) {
      ui.select({ t: "row", cardId, id: result.value.attributeId });
      setNameFocus(result.value.attributeId);
    }
  }

  const v = `${e.id}:${e.version}`;
  return (
    <div data-testid="panel-entity">
      <div className="mb-1.5 text-[11.5px] text-im-ink-3">Entity</div>
      <Field label="Name" htmlFor="f-en">
        <TextField key={v} id="f-en" value={e.name} required readOnly={!p.editable} onSave={(name) => void save({ name })} testId="input-entity-name" inputRef={nameRef} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Stereotype" htmlFor="f-es">
          <select
            key={v}
            id="f-es"
            defaultValue={e.stereotype}
            disabled={!p.editable}
            className={inputClass}
            data-testid="select-entity-stereotype"
            onChange={(x) => void save({ stereotype: x.target.value as Stereotype })}
          >
            {STEREOTYPES.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Concept" htmlFor="f-ec">
          <select
            key={v}
            id="f-ec"
            defaultValue={e.concept_id}
            disabled={!p.editable}
            className={inputClass}
            data-testid="select-entity-concept"
            onChange={(x) => void save({ conceptId: x.target.value })}
          >
            {ix.model.concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Definition" htmlFor="f-ed">
        <TextArea
          key={v}
          id="f-ed"
          value={e.definition_text ?? ""}
          readOnly={!p.editable}
          placeholder="What this entity means for the business."
          onSave={(text) => void save({ definition: text.trim() ? text : null })}
          data-testid="input-entity-definition"
        />
      </Field>

      <Fold title="Attributes and their sources" count={attributes.length}>
        {attributes.length ? (
          <LongList
            items={attributes}
            testId="list-entity-attributes"
            text={(a) => `${a.name} ${(ix.mappingsOf.get(a.id) ?? []).map((m) => inputsLabel(ix, m.id)).join(" ")}`}
            render={(a) => {
              const ms = ix.mappingsOf.get(a.id) ?? [];
              const meta = ms.length ? (
                <span className="font-mono text-xs">{ms.map((m) => inputsLabel(ix, m.id)).join(", ")}</span>
              ) : (
                <span className="italic">unmapped</span>
              );
              if (!p.editable) {
                return (
                  <Li key={a.id} onClick={() => p.goAttribute(a.id)} meta={meta}>
                    {a.name}
                  </Li>
                );
              }
              // Drag to reorder (D-36, prototype .li.ord): the line above or below shows where it goes.
              const hint = order.over?.id === a.id ? (order.over.after ? "shadow-[inset_0_-2px_0_var(--im-logical)]" : "shadow-[inset_0_2px_0_var(--im-logical)]") : "";
              return (
                <div
                  key={a.id}
                  draggable
                  data-testid="attribute-order-item"
                  data-attribute={a.id}
                  className={`flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover ${hint} ${order.dragging === a.id ? "text-im-ink-3" : ""}`}
                  onClick={() => p.goAttribute(a.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `attrorder:${a.id}`);
                    setOrder({ dragging: a.id, over: null });
                  }}
                  onDragOver={(e) => {
                    if (!order.dragging) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY >= r.top + r.height / 2;
                    if (order.over?.id !== a.id || order.over.after !== after) setOrder({ dragging: order.dragging, over: { id: a.id, after } });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = attributes.findIndex((x) => x.id === order.dragging);
                    const target = attributes.findIndex((x) => x.id === a.id);
                    let to = order.over?.after ? target + 1 : target;
                    if (from < to) to--;
                    const id = order.dragging;
                    setOrder({ dragging: null, over: null });
                    if (id && from >= 0) void move(id, to);
                  }}
                  onDragEnd={() => setOrder({ dragging: null, over: null })}
                >
                  <span className="w-3 flex-none text-[11px] tracking-[-2px] text-im-ink-3" aria-hidden>
                    ⋮⋮
                  </span>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{meta}</span>
                </div>
              );
            }}
          />
        ) : (
          <Hint>No attributes yet.</Hint>
        )}
        {p.editable && (
          <div className="mt-2 flex gap-2">
            <button type="button" className={smallButtonClass} onClick={() => void addAttribute()} data-testid="button-add-attribute">
              Add attribute
            </button>
          </div>
        )}
      </Fold>

      <Fold title="Feeding sources" count={feeds.length}>
        {feeds.length ? (
          <LongList
            items={feeds}
            text={(f) => f.table.name}
            render={({ table, mappings }) => {
              const here = p.cardOf(table.id);
              const dot = here ? "bg-im-physical" : p.elsewhere(table.id) ? "shadow-[inset_0_0_0_1.5px_var(--im-ink-3)]" : "";
              return (
                <Li
                  key={table.id}
                  title={here ? "On this canvas. Click to show it." : "Click to place it next to this card."}
                  onClick={() =>
                    here
                      ? (ui.select({ t: "card", id: here }), ui.centerOn(here))
                      : ui.placeBeside([{ target: { sourceTableId: table.id }, rows: (ix.columnsOf.get(table.id) ?? []).length }], cardId, "left")
                  }
                  meta={`${ix.systemName.get(table.source_system_id) ?? ""}, ${mappings} mapping${mappings === 1 ? "" : "s"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-[7px] flex-none rounded-full ${dot}`} />
                    <span className="truncate font-mono text-xs">{table.name}</span>
                  </span>
                </Li>
              );
            }}
          />
        ) : (
          <Hint>No source table maps into this entity yet.</Hint>
        )}
        {p.editable && missing.length > 0 && (
          <div className="mt-2 flex gap-2">
            <button type="button" className={smallButtonClass} onClick={() => ui.placeBeside(missing, cardId, "left")} data-testid="button-feed-all">
              {missing.length === feeds.length ? "Add all to this canvas" : `Add the ${missing.length} missing to this canvas`}
            </button>
          </div>
        )}
      </Fold>

      {relationships.length > 0 && (
        <Fold title="Relationships" count={relationships.length}>
          <LongList
            items={relationships}
            text={(r) => `${ix.entity.get(r.from_entity_id)?.name} ${r.label ?? ""} ${ix.entity.get(r.to_entity_id)?.name}`}
            render={(r) => (
              <Li key={r.id} onClick={() => ui.select({ t: "rel", id: r.id })}>
                {ix.entity.get(r.from_entity_id)?.name} {r.label || "relates to"} {ix.entity.get(r.to_entity_id)?.name}
              </Li>
            )}
          />
        </Fold>
      )}

      <OnCanvases kind="entity" targetId={e.id} cardId={cardId} />
      <CardFrame cardId={cardId} kind="ent" />

      {p.editable && (
        <Actions>
          <button type="button" className={buttonClass} onClick={() => ui.remove(cardId)} data-testid="button-remove-card">
            Remove from this canvas
          </button>
          <button type="button" className={dangerClass} onClick={() => setDeleting(true)} data-testid="button-delete-entity">
            Delete from model…
          </button>
        </Actions>
      )}
      {deleting && <DeleteEntityDialog entity={e} onClose={() => setDeleting(false)} />}
    </div>
  );
}
