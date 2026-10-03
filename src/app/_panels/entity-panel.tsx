"use client";

// The entity panel (prototype insEntity): name (focused right after “+”, D-46), stereotype, concept, definition
// (plain text, AD-30), attributes with their sources and “Add attribute”, feeding sources, relationships,
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
import { Actions, buttonClass, dangerClass, Field, Hint, inputClass, Li, List, Section, smallButtonClass, TextArea, TextField } from "./fields";
import { usePanel } from "./inspector";
import { feedingSources, inputsLabel } from "./model-index";
import { usePanels } from "./panels-context";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function EntityPanel({ entity: e, cardId }: { entity: Entity; cardId: Uuid }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const toast = useToast();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const ix = p.ix;
  const attributes = ix.attributesOf.get(e.id) ?? [];
  const feeds = feedingSources(ix, e.id);
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

      <Section>Attributes and their sources</Section>
      {attributes.length ? (
        <List testId="list-entity-attributes">
          {attributes.map((a) => {
            const ms = ix.mappingsOf.get(a.id) ?? [];
            return (
              <Li
                key={a.id}
                onClick={() => p.goAttribute(a.id)}
                meta={
                  ms.length ? (
                    <span className="font-mono text-xs">{ms.map((m) => inputsLabel(ix, m.id)).join(", ")}</span>
                  ) : (
                    <span className="italic">unmapped</span>
                  )
                }
              >
                {a.name}
              </Li>
            );
          })}
        </List>
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

      <Section>Feeding sources</Section>
      {feeds.length ? (
        <List>
          {feeds.map(({ table, mappings }) => {
            const here = p.cardOf(table.id);
            const dot = here ? "bg-im-physical" : p.elsewhere(table.id) ? "shadow-[inset_0_0_0_1.5px_var(--im-ink-3)]" : "";
            return (
              <Li
                key={table.id}
                title={here ? "On this canvas. Click to show it." : "Click to place it on the canvas."}
                onClick={() => (here ? (ui.select({ t: "card", id: here }), ui.centerOn(here)) : ui.place({ sourceTableId: table.id }, (ix.columnsOf.get(table.id) ?? []).length))}
                meta={`${ix.systemName.get(table.source_system_id) ?? ""}, ${mappings} mapping${mappings === 1 ? "" : "s"}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`size-[7px] flex-none rounded-full ${dot}`} />
                  <span className="truncate font-mono text-xs">{table.name}</span>
                </span>
              </Li>
            );
          })}
        </List>
      ) : (
        <Hint>No source table maps into this entity yet.</Hint>
      )}

      {relationships.length > 0 && (
        <>
          <Section>Relationships</Section>
          <List>
            {relationships.map((r) => (
              <Li key={r.id} onClick={() => ui.select({ t: "rel", id: r.id })}>
                {ix.entity.get(r.from_entity_id)?.name} {r.label || "relates to"} {ix.entity.get(r.to_entity_id)?.name}
              </Li>
            ))}
          </List>
        </>
      )}

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
