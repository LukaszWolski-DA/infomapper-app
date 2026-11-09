"use client";

// The relationship panel (prototype insRel): the two entities, the relationship read as sentences, the verb phrase,
// the cardinality at both ends, swap direction, delete. Drawing relationships on the canvas is slice 1b. From an entity
// to itself (slice 10a, D-61, F9) the two ends are named after the loop's drawing: from on the right, to on the top.

import { useContext } from "react";
import { deleteRelationshipAction, swapRelationshipAction, updateRelationshipAction } from "@/app/_actions/model";
import { useModules } from "@/app/_components/modules";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { CardinalityMax, CardinalityMin, Relationship } from "@/domain/types";
import { Actions, buttonClass, ConfirmDelete, dangerClass, Field, fieldKey, Kind, Seg, TextField } from "./fields";
import { PANEL_SECTIONS } from "@/compose/panels";
import { usePanel } from "./inspector";
import { ChecksBox } from "./checks-box";

/** The four cardinalities the prototype offers (CARDS). */
const CARDS = [
  ["0,1", "0..1"],
  ["1,1", "Exactly 1"],
  ["0,n", "0..*"],
  ["1,n", "1..*"],
] as const;
type Card = (typeof CARDS)[number][0];

const phrase = (min: CardinalityMin, max: CardinalityMax) =>
  max === "n" ? (min ? "one or more" : "zero or more") : min ? "exactly one" : "zero or one";

/** " as {role}" after the entity a role belongs to (slice 15b, RP-A, R-1); nothing without one. */
const as = (role: string | null) => (role?.trim() ? ` as ${role.trim()}` : "");

/**
 * The role fields' labels (slice 15b, R2): "Role of {entity}"; on a relationship to itself the cardinality fields' words
 * (D-61): "Role at the right end", "Role at the top end".
 */
export const roleLabel = (self: boolean, end: "from" | "to", name: string) => (self ? `Role at the ${end === "from" ? "right" : "top"} end` : `Role of ${name}`);

const split = (v: Card): { min: CardinalityMin; max: CardinalityMax } => {
  const [min, max] = v.split(",");
  return { min: min === "1" ? 1 : 0, max: max as CardinalityMax };
};

export function RelationshipPanel({ relationship: r }: { relationship: Relationship }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { saveRow } = useAction();
  const from = p.ix.entity.get(r.from_entity_id)?.name ?? "?";
  const to = p.ix.entity.get(r.to_entity_id)?.name ?? "?";
  const ref = (expectedVersion: number) => ({ relationshipId: r.id, expectedVersion });
  const self = r.from_entity_id === r.to_entity_id;
  const lookups = useModules().relationshipDeletes[r.id]?.then;

  const save = (change: Omit<Parameters<typeof updateRelationshipAction>[1], "relationshipId" | "expectedVersion">) =>
    saveRow(r, (v) => updateRelationshipAction(p.workspaceId, { ...ref(v), ...change }));

  async function remove() {
    const result = await saveRow(r, (v) => deleteRelationshipAction(p.workspaceId, ref(v)), "Relationship deleted", { undoable: true, deletes: true });
    if (result.ok) ui.select(null);
  }

  return (
    <div data-testid="panel-relationship">
      <Kind>Relationship</Kind>
      <ChecksBox of={{ t: "relationship", id: r.id }} />
      <h2 className="text-base font-semibold leading-snug">
        {from} and {to}
      </h2>
      <div className="mt-2.5 rounded-md bg-im-hover px-3 py-2.5 text-[12.5px]" data-testid="relationship-sentences">
        <p>
          Each {from} {r.label || "is related to"} {phrase(r.to_min, r.to_max)} {to}
          {as(r.to_role)}.
        </p>
        <p className="mt-1">
          Each {to} belongs to {phrase(r.from_min, r.from_max)} {from}
          {as(r.from_role)}.
        </p>
      </div>
      <Field label="Verb phrase" htmlFor="f-rl">
        <TextField
          key={fieldKey(r.id, "label")}
          id="f-rl"
          value={r.label ?? ""}
          readOnly={!p.editable}
          onSave={(label) => save({ label: label || null })}
          keep={{ key: fieldKey(r.id, "label"), field: "Label", object: `${from} – ${to}` }}
          testId="input-relationship-label"
        />
      </Field>
      {/* a role per end (slice 15b, RP-A): on any relationship, InfoMapper's; InfoCube reads the dimension's */}
      <Field label={roleLabel(self, "from", from)} htmlFor="f-rfr">
        <TextField
          key={fieldKey(r.id, "fromRole")}
          id="f-rfr"
          value={r.from_role ?? ""}
          readOnly={!p.editable}
          placeholder="e.g. Ship date"
          onSave={(fromRole) => save({ fromRole })}
          keep={{ key: fieldKey(r.id, "fromRole"), field: roleLabel(self, "from", from), object: `${from} – ${to}` }}
          testId="input-relationship-from-role"
        />
      </Field>
      <Field label={roleLabel(self, "to", to)} htmlFor="f-rtr">
        <TextField
          key={fieldKey(r.id, "toRole")}
          id="f-rtr"
          value={r.to_role ?? ""}
          readOnly={!p.editable}
          placeholder="e.g. Ship date"
          onSave={(toRole) => save({ toRole })}
          keep={{ key: fieldKey(r.id, "toRole"), field: roleLabel(self, "to", to), object: `${from} – ${to}` }}
          testId="input-relationship-to-role"
        />
      </Field>
      <Field label={self ? "At the right end" : `At the ${from} end`}>
        <Seg
          value={`${r.from_min},${r.from_max}` as Card}
          options={CARDS}
          disabled={!p.editable}
          testId="seg-relationship-from"
          onChange={(v) => {
            const c = split(v);
            save({ fromMin: c.min, fromMax: c.max });
          }}
        />
      </Field>
      <Field label={self ? "At the top end" : `At the ${to} end`}>
        <Seg
          value={`${r.to_min},${r.to_max}` as Card}
          options={CARDS}
          disabled={!p.editable}
          testId="seg-relationship-to"
          onChange={(v) => {
            const c = split(v);
            save({ toMin: c.min, toMax: c.max });
          }}
        />
      </Field>
      {/* the modules' sections (slice 15b): a fact – dimension relationship's key */}
      {PANEL_SECTIONS.relationship.map((S, i) => (
        <S key={i} relationship={r} />
      ))}
      {p.editable && (
        <Actions>
          <button
            type="button"
            className={buttonClass}
            data-testid="button-swap-relationship"
            onClick={() => void saveRow(r, (v) => swapRelationshipAction(p.workspaceId, ref(v)))}
          >
            Swap direction
          </button>
          {lookups?.length ? (
            // slice 18 (F14): with lookups through it, a second click that says what they lose
            <ConfirmDelete label="Delete relationship" then={lookups.join("; ")} onConfirm={() => void remove()} testId="button-delete-relationship" />
          ) : (
            <button type="button" className={dangerClass} onClick={() => void remove()} data-testid="button-delete-relationship">
              Delete relationship
            </button>
          )}
        </Actions>
      )}
    </div>
  );
}
