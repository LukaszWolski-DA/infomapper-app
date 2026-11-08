"use client";

// "Calculated from" in an attribute's panel, both levels (slice 18, item 1, D-73; prototype `calcSection`,
// `openCalcPick`): a sentence and "Calculate from attributes…" while it is not calculated; its inputs in order (each with
// its state, a link to it and ×), "Add inputs…", the rule, what its inputs say ("Every input is mapped." or "Not yet: …"),
// a warning when it is also mapped or fed directly (decision 2a), "Stop calculating"; "Used by" for the attributes
// calculated from it. Readers and reviewers see it without controls, and only when it has something to show (P7).
//
// Every write is on the save chain with the attribute's row checked (slice 9); × and "Stop calculating" hold the input
// rows they delete, as a mapping's × does. The rule keeps its draft (slice 13, `TextArea` with `keep`). The picker is
// slice 17's (`openPick`, several at once): the attributes of the same entity, those it reads already or calculated from
// it at any depth shown done (no cycle).

import { useEffect, useMemo, useRef } from "react";
import { useAction } from "@/app/_components/use-action";
import { useModules } from "@/app/_components/modules";
import { addAttributeInputsAction, calculateAttributeAction, removeAttributeInputAction, setCalculationRuleAction, stopCalculatingAction } from "@/app/_actions/derivation";
import type { Uuid } from "@/domain/ids";
import { calculationGaps, derivationIndex } from "@/domain/model/derivations";
import type { Attribute } from "@/domain/types";
import { openPick } from "@/ui/pick-popover";
import { Actions, Field, fieldKey, Fold, Hint, List, Note, smallButtonClass, TextArea } from "./fields";
import { usePanel } from "./inspector";

const RULE_ID = "f-calc";

export function CalculationSection({ attribute: a }: { attribute: Attribute }) {
  const p = usePanel();
  const { saveRow, saveRows } = useAction();
  const rowFeeds = useModules().rowFeeds;
  const ix = p.ix;
  const entity = ix.entity.get(a.entity_id);
  const dimensional = entity?.model_level === "dimensional";
  const word = dimensional ? "fed" : "mapped";
  const index = useMemo(() => derivationIndex(ix.model.attributes, ix.model.attributeInputs), [ix]);
  /** Mapped (logical) or fed (dimensional) directly: any mapping or feed, any status (acceptance F1). */
  const direct = (id: Uuid) => {
    const level = ix.entity.get(ix.attribute.get(id)?.entity_id ?? "")?.model_level;
    return level === "dimensional" ? (rowFeeds[id]?.n ?? 0) > 0 : (ix.mappingsOf.get(id)?.length ?? 0) > 0;
  };
  const name = (id: Uuid) => ix.attribute.get(id)?.name ?? "?";
  const inputs = index.inputsOf(a.id);
  const users = index.usersOf(a.id);
  const inputRows = ix.model.attributeInputs.filter((i) => i.attribute_id === a.id && i.deleted_at === null);

  // the rule takes the cursor after "Calculate from attributes…" picked its inputs (prototype: `#f-calc` focused)
  // (a wish, not state: the answer's fresh page renders the rule; then the effect takes the wish once)
  const focusRule = useRef(false);
  const ruleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusRule.current || !a.is_calculated) return;
    focusRule.current = false;
    ruleRef.current?.querySelector("textarea")?.focus();
  });

  const pick = (button: HTMLElement, first: boolean) => {
    const r = button.getBoundingClientRect();
    const have = new Set(inputs);
    openPick({
      at: { x: r.left, y: r.bottom + 4 },
      multi: true,
      title: first ? `Calculate ${a.name} from…` : `Add inputs to ${a.name}`,
      note: "Attributes of the same entity. One that is calculated from this attribute cannot be chosen.",
      placeholder: "Type to filter attributes…",
      empty: "This entity has no other attributes.",
      doneTitle: "Already an input, or calculated from this attribute",
      items: (ix.attributesOf.get(a.entity_id) ?? [])
        .filter((x) => x.deleted_at === null && x.id !== a.id)
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((x) => ({ id: x.id, label: x.name, key: x.data_type, done: have.has(x.id) || index.reaches(x.id, a.id) })),
      confirm: (n) => (n ? `Use ${n}` : "Use"),
      testId: "picker-calculation",
      pick: (inputIds) =>
        void saveRow(
          a,
          (v) => (first ? calculateAttributeAction : addAttributeInputsAction)(p.workspaceId, { attributeId: a.id, expectedVersion: v, inputIds }),
          (v) => v.toast,
          { undoable: true },
        ).then((result) => {
          if (!result.ok || !first) return;
          focusRule.current = true;
          // the fresh page may have rendered the rule already
          ruleRef.current?.querySelector("textarea")?.focus();
        }),
    });
  };

  const remove = (inputId: Uuid) => {
    const rows = inputRows.filter((i) => i.input_attribute_id === inputId);
    return saveRows([{ id: a.id, shown: a.version }, ...rows.map((i) => ({ id: i.id }))], (versionOf) =>
      removeAttributeInputAction(p.workspaceId, { attributeId: a.id, expectedVersion: versionOf(a.id), inputId }),
    );
  };
  const stop = () =>
    saveRows(
      [{ id: a.id, shown: a.version }, ...inputRows.map((i) => ({ id: i.id }))],
      (versionOf) => stopCalculatingAction(p.workspaceId, { attributeId: a.id, expectedVersion: versionOf(a.id) }),
      (v) => v.toast,
      { undoable: true },
    );

  const usedBy = users.length > 0 && (
    <p className="mt-1.5 text-xs text-im-ink-2" data-testid="calc-used-by">
      Used by{" "}
      {users.map((u, i) => (
        <span key={u}>
          {i > 0 && " "}
          <button type="button" className="rounded-md bg-im-logical-soft px-1.5 py-px text-im-logical" onClick={() => p.goAttribute(u)} data-testid="calc-user">
            {name(u)}
          </button>
        </span>
      ))}
    </p>
  );

  if (!a.is_calculated) {
    // readers and reviewers: only when other attributes are calculated from it (P7)
    if (!p.editable && !users.length) return null;
    return (
      <Fold title="Calculated from" testId="fold-calculation">
        {p.editable && <Hint>Not calculated. Mark it when its value is computed from other attributes of {entity?.name ?? "its entity"}.</Hint>}
        {p.editable && (
          <Actions>
            <button type="button" data-pop="" className={smallButtonClass} onClick={(e) => pick(e.currentTarget, true)} data-testid="button-calculate">
              Calculate from attributes…
            </button>
          </Actions>
        )}
        {usedBy}
      </Fold>
    );
  }

  const gaps = calculationGaps(index, a.id, direct);
  const viaOwn = inputs.some((f) => index.isCalculated(f));
  const alsoDirect = direct(a.id);
  return (
    <Fold title="Calculated from" count={inputs.length} testId="fold-calculation">
      {inputs.length > 0 && (
        <List testId="list-calculation-inputs">
          {inputs.map((f) => (
            <div key={f} className="flex items-center gap-2 px-2 py-1" data-testid="item-calculation-input" data-input={f}>
              <button type="button" className="min-w-0 flex-1 truncate text-left font-mono text-xs hover:underline" onClick={() => p.goAttribute(f)}>
                {name(f)}
              </button>
              <span className="flex-none text-[11.5px] text-im-ink-3" data-testid="calc-input-state">
                {direct(f) ? word : index.isCalculated(f) ? "calculated" : `not ${word}`}
              </span>
              {p.editable && (
                <button
                  type="button"
                  className="grid size-6 flex-none place-items-center rounded-md text-im-ink-3 hover:bg-im-hover"
                  title="Stop reading this attribute"
                  aria-label={`Stop reading ${name(f)}`}
                  onClick={() => void remove(f)}
                  data-testid="button-calc-remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </List>
      )}
      {p.editable && (
        <div className="mt-1.5">
          <button type="button" data-pop="" className={smallButtonClass} onClick={(e) => pick(e.currentTarget, false)} data-testid="button-calc-add">
            Add inputs…
          </button>
        </div>
      )}
      <div ref={ruleRef}>
        <Field label="Rule" htmlFor={RULE_ID}>
          <TextArea
            key={fieldKey(a.id, "calc_rule")}
            id={RULE_ID}
            code
            value={a.calc_rule ?? ""}
            readOnly={!p.editable}
            placeholder={`e.g. ${inputs.map(name).slice(0, 2).join(" * ") || "quantity * unit_price"}`}
            data-testid="input-calc-rule"
            onSave={(rule) => saveRow(a, (v) => setCalculationRuleAction(p.workspaceId, { attributeId: a.id, expectedVersion: v, rule: rule.trim() ? rule : null }))}
            keep={{ key: fieldKey(a.id, "calc_rule"), field: "Rule", object: a.name }}
          />
        </Field>
      </div>
      {!inputs.length ? (
        <Note warn testId="note-calc-state">Choose the attributes it is calculated from.</Note>
      ) : gaps.length ? (
        <Note warn testId="note-calc-state">
          Not yet: {gaps.map(name).join(", ")} {gaps.length > 1 ? "are" : "is"} not {word}.
        </Note>
      ) : (
        <Note testId="note-calc-state">
          Every input is {word}
          {viaOwn ? ", directly or through its own calculation" : ""}.
        </Note>
      )}
      {alsoDirect && (
        <Note warn testId="note-calc-also">
          It is also {word} directly. Keep one way to get its value: the calculation or the {dimensional ? "feed" : "mapping"}.
        </Note>
      )}
      {p.editable && (
        <Actions>
          <button type="button" className={smallButtonClass} onClick={() => void stop()} data-testid="button-calc-stop">
            Stop calculating
          </button>
        </Actions>
      )}
      {usedBy}
    </Fold>
  );
}
