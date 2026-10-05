"use client";

// The relationship panel (prototype insRel): the two entities, the relationship read as sentences, the verb phrase,
// the cardinality at both ends, swap direction, delete. Drawing relationships on the canvas is slice 1b.

import { useContext } from "react";
import { deleteRelationshipAction, swapRelationshipAction, updateRelationshipAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { CardinalityMax, CardinalityMin, Relationship } from "@/domain/types";
import { Actions, buttonClass, dangerClass, Field, Kind, Seg, TextField } from "./fields";
import { usePanel } from "./inspector";

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

const split = (v: Card): { min: CardinalityMin; max: CardinalityMax } => {
  const [min, max] = v.split(",");
  return { min: min === "1" ? 1 : 0, max: max as CardinalityMax };
};

export function RelationshipPanel({ relationship: r }: { relationship: Relationship }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const from = p.ix.entity.get(r.from_entity_id)?.name ?? "?";
  const to = p.ix.entity.get(r.to_entity_id)?.name ?? "?";
  const ref = { relationshipId: r.id, expectedVersion: r.version };

  const save = (change: Omit<Parameters<typeof updateRelationshipAction>[1], "relationshipId" | "expectedVersion">) =>
    void run(() => updateRelationshipAction(p.workspaceId, { ...ref, ...change }));

  async function remove() {
    const result = await run(() => deleteRelationshipAction(p.workspaceId, ref), "Relationship deleted", { undoable: true });
    if (result.ok) ui.select(null);
  }

  return (
    <div data-testid="panel-relationship">
      <Kind>Relationship</Kind>
      <h2 className="text-base font-semibold leading-snug">
        {from} and {to}
      </h2>
      <div className="mt-2.5 rounded-md bg-im-hover px-3 py-2.5 text-[12.5px]" data-testid="relationship-sentences">
        <p>
          Each {from} {r.label || "is related to"} {phrase(r.to_min, r.to_max)} {to}.
        </p>
        <p className="mt-1">
          Each {to} belongs to {phrase(r.from_min, r.from_max)} {from}.
        </p>
      </div>
      <Field label="Verb phrase" htmlFor="f-rl">
        <TextField
          key={`${r.id}:${r.version}`}
          id="f-rl"
          value={r.label ?? ""}
          readOnly={!p.editable}
          onSave={(label) => save({ label: label || null })}
          testId="input-relationship-label"
        />
      </Field>
      <Field label={`At the ${from} end`}>
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
      <Field label={`At the ${to} end`}>
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
      {p.editable && (
        <Actions>
          <button
            type="button"
            className={buttonClass}
            data-testid="button-swap-relationship"
            onClick={() => void run(() => swapRelationshipAction(p.workspaceId, ref))}
          >
            Swap direction
          </button>
          <button type="button" className={dangerClass} onClick={() => void remove()} data-testid="button-delete-relationship">
            Delete relationship
          </button>
        </Actions>
      )}
    </div>
  );
}
