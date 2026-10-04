"use client";

// The mapping panel (prototype insMap, D-49): source and target, the type check message (D-01), the Inputs section
// (order, add, remove; a click on an input puts its column into the rule), how the value is carried (kind), the rule,
// status with four-eyes (AD-06), note, other sources of the attribute, delete. A second input turns the mapping
// into a transformation and is saved only together with a rule. Changing an approved mapping's inputs, kind or rule
// sends it back to review (D-51); the server says so and the panel shows it. Slice 1b: “Split into separate
// mappings” and “Merge mappings” with the attribute's other mappings, which needs a rule (D-49).

import { useContext, useEffect, useRef, useState } from "react";
import {
  addMappingInputAction,
  deleteMappingAction,
  mergeMappingsAction,
  removeMappingInputAction,
  reorderMappingInputsAction,
  setMappingStatusAction,
  splitMappingAction,
  updateMappingAction,
} from "@/app/_actions/mapping";
import { useAction } from "@/app/_components/use-action";
import type { ActionResult } from "@/app/_lib/run-command";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { FOUR_EYES_MESSAGE } from "@/domain/model/mapping-rules";
import { formatColumnType } from "@/domain/model/type-check";
import type { Mapping, MappingKind, MappingStatus } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { STATUS_LABEL } from "./attribute-panel";
import { Actions, buttonClass, ConfirmDelete, Field, Fold, GroupedSelect, inputClass, Kind, Li, List, LongList, Note, Seg, TextArea, TypeDot } from "./fields";
import { usePanel } from "./inspector";
import { usePanels } from "./panels-context";
import { columnLabel, columnOptions, inputsLabel, typeCheckOf } from "./model-index";

const KINDS = [
  ["direct", "Direct copy"],
  ["transform", "Transformation"],
] as const;
const STATUSES = [
  ["draft", STATUS_LABEL.draft],
  ["review", STATUS_LABEL.review],
  ["approved", STATUS_LABEL.approved],
] as const;

const iconButton = "grid size-6 flex-none place-items-center rounded text-im-ink-3 hover:bg-im-hover hover:text-im-ink disabled:opacity-30";

export function MappingPanel({ mapping: m }: { mapping: Mapping }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const toast = useToast();
  const ix = p.ix;
  const attribute = ix.attribute.get(m.attribute_id);
  const inputs = ix.inputsOf.get(m.id) ?? [];
  const check = typeCheckOf(ix, m);
  const others = (ix.mappingsOf.get(m.attribute_id) ?? []).filter((x) => x.id !== m.id);
  const rule = useRef<HTMLTextAreaElement>(null);
  /** A column picked as a further input, waiting for the rule it needs (D-49). */
  const [pending, setPending] = useState<Uuid | null>(null);
  /** Transformation chosen, but no rule written yet. */
  const [wantsRule, setWantsRule] = useState(false);

  // “Add to mapping …” from the canvas or the column panel (D-48): the column waits here for its rule.
  const { pendingInput, clearPendingInput } = p;
  useEffect(() => {
    if (pendingInput?.mappingId !== m.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- takes over a request made outside the panel
    setPending(pendingInput.columnId);
    clearPendingInput();
    setTimeout(() => rule.current?.focus(), 0);
  }, [pendingInput, clearPendingInput, m.id]);

  /** “Merge mappings”: open, and the other mappings ticked to go into this one. */
  const [merging, setMerging] = useState<Set<Uuid> | null>(null);
  const mergeRule = useRef<HTMLTextAreaElement>(null);
  const { mergeFocus, setMergeFocus } = usePanels();
  useEffect(() => {
    if (mergeFocus !== m.id) return;
    setMergeFocus(null);
    if (!p.editable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- takes over a request made in the toolbox
    setMerging(new Set());
  }, [mergeFocus, setMergeFocus, m.id, p.editable]);

  async function split() {
    await run(
      () => splitMappingAction(p.workspaceId, ref),
      (v) => v.notice ?? `Split into ${v.mappings} separate mappings.`,
    );
  }

  async function merge() {
    if (!merging?.size) return;
    const chosen = others.filter((o) => merging.has(o.id));
    const result = await run(
      () =>
        mergeMappingsAction(p.workspaceId, {
          mappings: [ref, ...chosen.map((o) => ({ mappingId: o.id, expectedVersion: o.version }))],
          ruleExpression: mergeRule.current?.value ?? "",
        }),
      `Merged ${chosen.length + 1} mappings into one transformation.`,
    );
    if (result.ok) setMerging(null);
  }

  // “Edit transformation rule…” in the toolbox: a direct copy becomes a transformation waiting for its rule.
  const { ruleFocus, setRuleFocus } = usePanels();
  useEffect(() => {
    if (ruleFocus !== m.id) return;
    setRuleFocus(null);
    if (!p.editable) return;
    if (m.kind === "transform") setTimeout(() => rule.current?.focus(), 0);
    else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- takes over a request made in the toolbox
      setWantsRule(true);
      setTimeout(() => rule.current?.focus(), 0);
    }
  }, [ruleFocus, setRuleFocus, m.id, m.kind, p.editable]);

  const kind: MappingKind = pending || wantsRule ? "transform" : m.kind;
  const ruleOpen = p.editable && kind === "transform";
  const ref = { mappingId: m.id, expectedVersion: m.version };

  /** Runs a write that may carry D-51's notice. */
  async function write(action: () => Promise<ActionResult<{ notice: string | null }>>) {
    const result = await run(action);
    if (result.ok && result.value.notice) toast(result.value.notice);
    return result.ok;
  }

  const focusRule = () => setTimeout(() => rule.current?.focus(), 0);

  function chooseKind(next: MappingKind) {
    if (next === "transform") {
      if (m.rule_expression?.trim()) void write(() => updateMappingAction(p.workspaceId, { ...ref, kind: "transform" }));
      else {
        setWantsRule(true);
        focusRule();
      }
    } else if (wantsRule || pending) {
      setWantsRule(false);
      setPending(null);
    } else void write(() => updateMappingAction(p.workspaceId, { ...ref, kind: "direct" }));
  }

  function onRuleBlur(text: string) {
    if (pending) return; // saved with the input
    const value = text.trim();
    if (wantsRule) {
      setWantsRule(false);
      if (value) void write(() => updateMappingAction(p.workspaceId, { ...ref, kind: "transform", ruleExpression: value }));
      return;
    }
    if (m.kind === "transform" && value !== (m.rule_expression ?? "")) {
      void write(() => updateMappingAction(p.workspaceId, { ...ref, ruleExpression: value || null }));
    }
  }

  /** A click on an input puts its column name into the rule, at the cursor (D-49). */
  function insert(columnId: Uuid) {
    const el = rule.current;
    const name = ix.column.get(columnId)?.name;
    if (!el || !name || el.disabled) return;
    const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
    el.setRangeText(name, start, end, "end");
    el.focus();
  }

  function addInput(columnId: Uuid) {
    if (m.rule_expression?.trim()) void write(() => addMappingInputAction(p.workspaceId, { ...ref, sourceColumnId: columnId }));
    else {
      setPending(columnId);
      focusRule();
    }
  }

  async function savePending() {
    if (!pending) return;
    const ok = await write(() =>
      addMappingInputAction(p.workspaceId, { ...ref, sourceColumnId: pending, ruleExpression: rule.current?.value ?? "" }),
    );
    if (ok) setPending(null);
  }

  function move(index: number, by: -1 | 1) {
    const ids = inputs.map((i) => i.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    void write(() => reorderMappingInputsAction(p.workspaceId, { ...ref, mappingInputIds: ids }));
  }

  async function remove() {
    const result = await run(() => deleteMappingAction(p.workspaceId, ref), "Mapping deleted");
    if (result.ok) ui.select(null);
  }

  const first = inputs[0] ? ix.column.get(inputs[0].source_column_id) : undefined;
  const firstTable = first ? ix.table.get(first.source_table_id)?.name : undefined;
  const fourEyesBlocks = p.fourEyes && m.status !== "approved" && p.contentAuthors[m.id] === p.userId;
  const v = `${m.id}:${m.version}`;

  return (
    <div data-testid="panel-mapping">
      <Kind>Mapping</Kind>
      <div className="mb-1 mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <button
          type="button"
          className="min-w-0 rounded-md bg-im-physical-soft px-2.5 py-[7px] text-left text-im-physical"
          onClick={() => first && p.goColumn(first.id)}
        >
          <small className="block text-[10.5px] opacity-80">{inputs.length > 1 ? `${inputs.length} inputs` : firstTable}</small>
          <b className="block truncate font-mono text-xs font-medium">
            {inputs.map((i) => ix.column.get(i.source_column_id)?.name).join(", ")}
          </b>
        </button>
        <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-im-ink-3 stroke-[1.6]" aria-hidden>
          <path d="M2.5 8h11M9.5 4l4 4-4 4" />
        </svg>
        <button
          type="button"
          className="min-w-0 rounded-md bg-im-logical-soft px-2.5 py-[7px] text-left text-im-logical"
          onClick={() => attribute && p.goAttribute(attribute.id)}
        >
          <small className="block text-[10.5px] opacity-80">{attribute ? ix.entity.get(attribute.entity_id)?.name : ""}</small>
          <b className="block truncate font-medium">{attribute?.name}</b>
        </button>
      </div>
      <Note warn={!check.ok} testId="note-type-check">
        {check.message}
      </Note>

      <Fold title="Inputs" count={inputs.length}>
        <List testId="list-mapping-inputs">
          {inputs.map((i, index) => {
            const c = ix.column.get(i.source_column_id);
            const problem = check.problems.find((x) => x.source_column_id === i.source_column_id);
            return (
              <div key={i.id} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-im-hover" data-testid="mapping-input">
                <span className="w-4 flex-none text-right text-[11px] tabular-nums text-im-ink-3">{index + 1}</span>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-mono text-xs disabled:cursor-default"
                  title={ruleOpen ? "Click to put this column into the rule" : columnLabel(ix, i.source_column_id)}
                  disabled={!ruleOpen}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(i.source_column_id)}
                >
                  {columnLabel(ix, i.source_column_id)}
                </button>
                <span className={`flex-none font-mono text-[11px] ${problem ? "text-im-warn" : "text-im-ink-3"}`} title={problem?.message}>
                  {c ? formatColumnType(c) : ""}
                </span>
                {p.editable && (
                  <>
                    <button type="button" className={iconButton} aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      ↑
                    </button>
                    <button type="button" className={iconButton} aria-label="Move down" disabled={index === inputs.length - 1} onClick={() => move(index, 1)}>
                      ↓
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Remove ${columnLabel(ix, i.source_column_id)}`}
                      data-testid="button-remove-input"
                      onClick={() => void write(() => removeMappingInputAction(p.workspaceId, { ...ref, mappingInputId: i.id }))}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {pending && (
            <div className="flex items-center gap-1.5 rounded-md border border-dashed border-im-line px-2 py-1" data-testid="mapping-input-pending">
              <span className="w-4 flex-none text-right text-[11px] text-im-ink-3">{inputs.length + 1}</span>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-mono text-xs"
                title="Click to put this column into the rule"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(pending)}
              >
                {columnLabel(ix, pending)}
              </button>
              <span className="text-[11px] text-im-ink-3">not saved yet</span>
            </div>
          )}
        </List>
        {p.editable && !pending && (
          <div className="mt-2">
            <GroupedSelect
              placeholder="Add an input…"
              groups={columnOptions(ix, p.tablesHere, new Set(inputs.map((i) => i.source_column_id)))}
              onPick={addInput}
              testId="select-add-input"
            />
          </div>
        )}
      </Fold>

      <Field label="How the value is carried">
        <Seg value={kind} options={KINDS} onChange={chooseKind} disabled={!p.editable} testId="seg-mapping-kind" />
      </Field>
      <Field label="Transformation rule" htmlFor="f-rule">
        <textarea
          key={v}
          ref={rule}
          id="f-rule"
          defaultValue={m.rule_expression ?? ""}
          disabled={!ruleOpen}
          readOnly={!p.editable}
          placeholder={`e.g. CAST(${first?.name ?? "column"} AS date), a lookup, or plain words`}
          data-testid="input-mapping-rule"
          className={`${inputClass} min-h-[60px] resize-y font-mono text-xs`}
          onBlur={(e) => onRuleBlur(e.currentTarget.value)}
        />
      </Field>
      {pending && (
        <Note warn testId="note-rule-needed">
          A mapping with more than one input needs a transformation rule. Write it, then save.
          <div className="mt-2 flex gap-2">
            <button type="button" className={buttonClass} onClick={() => void savePending()} data-testid="button-save-input">
              Save
            </button>
            <button type="button" className={buttonClass} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </Note>
      )}
      {wantsRule && !pending && <Note warn>A transformation needs a rule. Write it; it is saved when you leave the field.</Note>}

      <Field label="Status">
        <Seg
          value={m.status}
          options={STATUSES}
          disabled={!p.canSetStatus}
          testId="seg-mapping-status"
          onChange={(status: MappingStatus) => void run(() => setMappingStatusAction(p.workspaceId, { ...ref, status }))}
        />
      </Field>
      {fourEyesBlocks && <Note warn testId="note-four-eyes">{FOUR_EYES_MESSAGE}</Note>}
      <Field label="Note" htmlFor="f-note">
        <TextArea
          key={v}
          id="f-note"
          value={m.note_text ?? ""}
          readOnly={!p.editable}
          placeholder="Why this mapping, open questions, who decided"
          onSave={(note) => void write(() => updateMappingAction(p.workspaceId, { ...ref, note: note.trim() ? note : null }))}
        />
      </Field>

      {others.length > 0 && attribute && (
        <Fold title={`Other sources for ${attribute.name}`} count={others.length}>
          <LongList
            items={others}
            text={(o) => inputsLabel(ix, o.id)}
            render={(o) => (
              <Li key={o.id} onClick={() => p.goMapping(o.id)} meta={STATUS_LABEL[o.status]}>
                <span className="flex items-center gap-2">
                  <TypeDot ok={typeCheckOf(ix, o).ok} />
                  <span className="truncate font-mono text-xs">{inputsLabel(ix, o.id)}</span>
                </span>
              </Li>
            )}
          />
        </Fold>
      )}

      {merging && (
        <Fold title="Merge mappings" count={others.length}>
          <p className="mb-1.5 text-im-ink-3">Tick the mappings to combine with this one. Their inputs follow this mapping’s, in this order.</p>
          <List testId="list-merge-mappings">
            {others.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-im-hover">
                <input
                  type="checkbox"
                  checked={merging.has(o.id)}
                  data-testid="check-merge-mapping"
                  onChange={(e) => {
                    const next = new Set(merging);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    setMerging(next);
                  }}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{inputsLabel(ix, o.id)}</span>
                <span className="text-[11.5px] text-im-ink-3">{STATUS_LABEL[o.status]}</span>
              </label>
            ))}
          </List>
          <Field label="Transformation rule of the merged mapping" htmlFor="f-merge-rule">
            <textarea
              ref={mergeRule}
              id="f-merge-rule"
              defaultValue={m.rule_expression ?? ""}
              placeholder="e.g. COALESCE(crm_email, web_email)"
              data-testid="input-merge-rule"
              className={`${inputClass} min-h-[60px] resize-y font-mono text-xs`}
            />
          </Field>
          <Note warn>The merged mapping is a transformation and goes to review; it needs a rule.</Note>
          <div className="mt-2 flex gap-2">
            <button type="button" className={buttonClass} disabled={!merging.size} onClick={() => void merge()} data-testid="button-merge">
              Merge
            </button>
            <button type="button" className={buttonClass} onClick={() => setMerging(null)}>
              Cancel
            </button>
          </div>
        </Fold>
      )}

      {p.editable && (
        <Actions>
          {inputs.length > 1 && (
            <button type="button" className={buttonClass} onClick={() => void split()} data-testid="button-split-mapping">
              Split into separate mappings
            </button>
          )}
          {others.length > 0 && !merging && (
            <button type="button" className={buttonClass} onClick={() => setMerging(new Set())} data-testid="button-merge-mappings">
              Merge mappings…
            </button>
          )}
          <ConfirmDelete label="Delete mapping" onConfirm={() => void remove()} testId="button-delete-mapping" />
        </Actions>
      )}
    </div>
  );
}
