"use client";

// The dimensional mapping's panel (slice 15c, B-4, O9, O12, X2, X5; prototype `insCmap`): the kind with the InfoCube
// badge, the trace (the inputs' pills, the target's), the type warning of a direct copy, "Reads from the logical model"
// (× on every input but the last one), "Add a logical attribute", "Target attribute", "How the value is carried", the
// rule, the status (reviewers too; four-eyes says beforehand who may not approve), the note and "Delete mapping". Every
// write is a module command on the save chain with the mapping's row checked (slice 9, 10a); removing an input holds
// that input's row too. A change of the inputs, the kind, the rule or the target sends an approved mapping back to
// review (D-51, the server's notice); the note alone does not. The fields keep their drafts (slice 13). Slice 18 (item 4,
// prototype `lookupFields`): a third kind, Lookup, with "Through relationship", "When no match" and its sentence in place
// of the rule; a change of either sends an approved lookup back to review.

import { useContext, useEffect, useMemo } from "react";
import { useAction } from "@/app/_components/use-action";
import { useModules } from "@/app/_components/modules";
import { Actions, dangerClass, Field, fieldKey, Fold, GroupedSelect, inputClass, Kind, List, Note, Seg, TextArea, TextField, useChoice } from "@/app/_panels/fields";
import { usePanel, type PanelContext } from "@/app/_panels/inspector";
import { CanvasUiCtx } from "@/canvas/context";
import { useValue } from "@/canvas/value-store";
import type { ActionResult } from "@/app/_lib/run-command";
import type { Uuid } from "@/domain/ids";
import { FOUR_EYES_MESSAGE } from "@/domain/model/mapping-rules";
import type { Attribute } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { CubeIcon } from "../ui/cube-icon";
import { typeWord } from "../domain/keys";
import {
  LOOKUP_RELATIONSHIP_GONE,
  lookupNoRelationship,
  lookupRelationshipGone,
  lookupRelationships,
  lookupSentence,
  relationshipText,
  typesDiffer,
  type MappingIndex,
} from "../domain/mappings";
import type { CubeMappingKind, CubeMappingStatus } from "../domain/types";
import type { CubePageRows } from "../domain/view";
import { addCubeMappingInputAction, removeCubeMappingInputAction, retargetCubeMappingAction, setCubeMappingStatusAction, updateCubeMappingAction } from "./actions";
import { useCubeMappingDelete, useMappingIndex } from "./canvas-ext";
import { ruleFocus } from "./rule-focus";

const KINDS = [
  ["direct", "Direct copy"],
  ["transform", "Transformation"],
  ["lookup", "Lookup"],
] as const;
export const CUBE_STATUS_LABEL: Record<CubeMappingStatus, string> = { draft: "Draft", review: "In review", approved: "Approved" };
const STATUSES = [
  ["draft", CUBE_STATUS_LABEL.draft],
  ["review", CUBE_STATUS_LABEL.review],
  ["approved", CUBE_STATUS_LABEL.approved],
] as const;
const RULE_ID = "f-crule";
const VIA_ID = "f-cvia";
const NO_MATCH_ID = "f-cunk";

/** The prototype's `attrOptions`: one group per entity of a level, those on this canvas first, then the others. */
export function attributeGroups(index: MappingIndex, p: Pick<PanelContext, "ix" | "entitiesHere">, level: "logical" | "dimensional", except: ReadonlySet<Uuid> = new Set()) {
  const entities = p.ix.model.entities.filter((e) => e.deleted_at === null && (e.model_level === "dimensional") === (level === "dimensional"));
  const here = entities.filter((e) => p.entitiesHere.has(e.id));
  const elsewhere = entities.filter((e) => !p.entitiesHere.has(e.id));
  return [...here, ...elsewhere]
    .map((e) => ({
      label: p.entitiesHere.has(e.id) ? e.name : `${e.name} (not on canvas)`,
      columns: index
        .attributesOf(e.id)
        .filter((a) => !except.has(a.id))
        .map((a: Attribute) => ({ id: a.id, label: `${a.name}  ${typeWord(a)}` })),
    }))
    .filter((g) => g.columns.length);
}

const pillClass = "flex min-w-0 flex-col rounded-md bg-im-logical-soft px-2.5 py-[7px] text-left text-im-logical";

export function CubeMappingPanel({ id }: { id: Uuid }) {
  const p = usePanel();
  const index = useMappingIndex(p.ix.model);
  const m = index.mapping(id);
  // a new mapping's id stays the selection until its row reaches the page
  return m ? <MappingFields key={id} id={id} index={index} /> : null;
}

function MappingFields({ id, index }: { id: Uuid; index: MappingIndex }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { saveRow, saveRows } = useAction();
  const remove = useCubeMappingDelete(p.workspaceId, index);
  const rows = useModules().data.infocube as CubePageRows | undefined;
  const m = index.mapping(id)!;
  const inputs = index.inputsOf(id);
  const target = index.attribute(m.attribute_id);
  const ref = (expectedVersion: number) => ({ mappingId: m.id, expectedVersion });
  const focusRule = () => setTimeout(() => document.getElementById(RULE_ID)?.focus(), 0);

  // "Edit transformation rule…" and the like: the cursor goes into the rule once it can take it
  const wantsFocus = useValue(ruleFocus);
  useEffect(() => {
    if (wantsFocus !== id || m.kind !== "transform") return;
    ruleFocus.set(null);
    focusRule();
  }, [wantsFocus, id, m.kind]);

  /**
   * A write that may carry D-51's notice ("… sends it back to review"). One toast shows at a time: with a toast of its
   * own ("It reads … too.", "Re-pointed to …") the notice follows it in the same toast, else it is the toast.
   */
  const write = async <T extends { notice: string | null }>(send: (v: number) => Promise<ActionResult<T>>, success?: (v: T) => string) => {
    const result = await saveRow(m, send, success ? (v: T) => [success(v), v.notice].filter(Boolean).join(" ") : undefined);
    if (result.ok && result.value.notice && !success) toast(result.value.notice);
    return result;
  };

  const kind = useChoice<CubeMappingKind>(m.kind, async (next) => {
    const result = await write((v) => updateCubeMappingAction(p.workspaceId, { ...ref(v), kind: next }));
    if (result.ok && next === "transform") ruleFocus.set(m.id);
    // slice 18 (prototype `cmap.kind`): the cursor goes to the value for no match when a relationship is set (or was
    // chosen for you), else to the relationship
    if (result.ok && next === "lookup") {
      const chosen = m.lookup_relationship_id !== null || lookupRelationships(index, p.ix.model.relationships, m.id).length === 1;
      setTimeout(() => document.getElementById(chosen ? NO_MATCH_ID : VIA_ID)?.focus(), 0);
    }
    return result;
  });
  const via = useChoice<string>(m.lookup_relationship_id ?? "", (next) => write((v) => updateCubeMappingAction(p.workspaceId, { ...ref(v), lookupRelationshipId: next || null })));
  const status = useChoice<CubeMappingStatus>(m.status, (next) => saveRow(m, (v) => setCubeMappingStatusAction(p.workspaceId, { ...ref(v), status: next })));
  const retarget = useChoice<Uuid>(m.attribute_id, (to) => write((v) => retargetCubeMappingAction(p.workspaceId, { ...ref(v), attributeId: to }), (v) => v.toast));

  async function addInput(attributeId: Uuid) {
    const result = await write((v) => addCubeMappingInputAction(p.workspaceId, { ...ref(v), attributeId }), (v) => v.toast);
    if (result.ok && result.value.becameTransform) ruleFocus.set(m.id);
  }

  async function removeInput(inputId: Uuid) {
    // the input's row is written too (soft-deleted): held while the mapping's save is on its way (slice 10a)
    const result = await saveRows([{ id: m.id, shown: m.version }, { id: inputId }], (versionOf) =>
      removeCubeMappingInputAction(p.workspaceId, { ...ref(versionOf(m.id)), inputId }),
    );
    if (result.ok && result.value.notice) toast(result.value.notice);
  }

  // a lookup reads the dictionary's value as a direct copy reads its attribute: the types must fit (slice 18)
  const types = m.kind !== "transform" ? inputs.map((i) => typesDiffer(index.attribute(i.attribute_id), target)).find((t) => t) : null;
  const logical = useMemo(() => attributeGroups(index, p, "logical", new Set(index.inputsOf(id).map((i) => i.attribute_id))), [index, p, id]);
  const dimensional = useMemo(() => attributeGroups(index, p, "dimensional"), [index, p]);
  const fourEyesBlocks = p.fourEyes && m.status !== "approved" && rows?.contentAuthors?.[m.id] === p.userId;
  const ruleOpen = p.editable && kind.value === "transform";

  return (
    <div data-testid="panel-cube-mapping" data-mapping={id} data-status={m.status} data-version={m.version}>
      <Kind>
        Dimensional mapping{" "}
        <span className="stereo cube inline-flex items-center gap-1 font-medium">
          <CubeIcon />
          InfoCube
        </span>
      </Kind>
      <div className="mb-1 mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5" data-testid="cube-mapping-trace">
        <span className="flex min-w-0 flex-col gap-1">
          {inputs.map((i) => {
            const a = index.attribute(i.attribute_id);
            return (
              <button key={i.id} type="button" className={pillClass} onClick={() => p.goAttribute(i.attribute_id)} data-testid="trace-input">
                <small className="block text-[10.5px] opacity-80">{a ? index.entity(a.entity_id)?.name : ""}</small>
                <b className="block truncate font-medium">{a?.name}</b>
              </button>
            );
          })}
        </span>
        <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-im-ink-3 stroke-[1.6]" aria-hidden>
          <path d="M2.5 8h11M9.5 4l4 4-4 4" />
        </svg>
        <button type="button" className={`${pillClass} border border-im-ink-3`} onClick={() => target && p.goAttribute(target.id)} data-testid="trace-target">
          <small className="block text-[10.5px] opacity-80">{target ? index.entity(target.entity_id)?.name : ""}</small>
          <b className="block truncate font-medium">{target?.name}</b>
        </button>
      </div>
      {types && (
        <Note warn testId="note-cube-types">
          The types differ: {types[0]} → {types[1]}. Use a transformation, or change one of the types.
        </Note>
      )}

      <Fold title="Reads from the logical model" count={inputs.length}>
      <List testId="list-cube-inputs">
        {inputs.map((i) => (
          <div key={i.id} className="flex items-center gap-1.5 rounded-md px-2 py-1" data-testid="cube-input">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{index.label(i.attribute_id)}</span>
            {p.editable && inputs.length > 1 && (
              <button
                type="button"
                className="grid size-6 flex-none place-items-center rounded text-im-ink-3 hover:bg-im-hover hover:text-im-ink"
                title="Stop reading this attribute"
                aria-label={`Stop reading ${index.label(i.attribute_id)}`}
                data-testid="button-remove-cube-input"
                onClick={() => void removeInput(i.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </List>
      {p.editable && (
        <Field label="Add a logical attribute" htmlFor="f-cfrom">
          <GroupedSelect id="f-cfrom" placeholder="Choose an attribute…" groups={logical} onPick={(a) => void addInput(a)} testId="select-add-cube-input" />
        </Field>
      )}
      </Fold>
      <Field label="Target attribute" htmlFor="f-cto">
        <select
          key={fieldKey(m.id, "target")}
          id="f-cto"
          value={retarget.value}
          disabled={!p.editable}
          className={inputClass}
          data-testid="select-cube-target"
          onChange={(e) => retarget.choose(e.target.value)}
        >
          {dimensional.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="How the value is carried">
        <Seg value={kind.value} options={KINDS} onChange={kind.choose} disabled={!p.editable} testId="seg-cube-kind" />
      </Field>
      {kind.value === "lookup" ? (
        <LookupFields id={id} index={index} via={via} write={write} />
      ) : (
        <Field label="Transformation rule" htmlFor={RULE_ID}>
          <TextArea
            key={fieldKey(m.id, "rule")}
            id={RULE_ID}
            code
            value={m.rule_expression ?? ""}
            disabled={!ruleOpen}
            readOnly={!p.editable}
            placeholder="e.g. a key lookup, a date key, or plain words"
            data-testid="input-cube-rule"
            onSave={(rule) => write((v) => updateCubeMappingAction(p.workspaceId, { ...ref(v), ruleExpression: rule.trim() ? rule : null }))}
            keep={{ key: fieldKey(m.id, "rule"), field: "Transformation rule", object: `the mapping to ${target?.name ?? "?"}` }}
          />
        </Field>
      )}
      <Field label="Status">
        <Seg value={status.value} options={STATUSES} onChange={status.choose} disabled={!p.canSetStatus} testId="seg-cube-status" />
      </Field>
      {fourEyesBlocks && <Note warn testId="note-four-eyes">{FOUR_EYES_MESSAGE}</Note>}
      <Field label="Note" htmlFor="f-cnote">
        <TextArea
          key={fieldKey(m.id, "note")}
          id="f-cnote"
          value={m.note ?? ""}
          readOnly={!p.editable}
          placeholder="Why this mapping, open questions, who decided"
          data-testid="input-cube-note"
          onSave={(note) => saveRow(m, (v) => updateCubeMappingAction(p.workspaceId, { ...ref(v), note: note.trim() ? note : null }))}
          keep={{ key: fieldKey(m.id, "note"), field: "Note", object: `the mapping to ${target?.name ?? "?"}` }}
        />
      </Field>
      {p.editable && (
        <Actions>
          <button
            type="button"
            className={dangerClass}
            data-testid="button-delete-cube-mapping"
            onClick={() =>
              void remove(m.id).then((ok) => {
                if (ok) ui.select(null);
              })
            }
          >
            Delete mapping
          </button>
        </Actions>
      )}
    </div>
  );
}

/**
 * A lookup's fields (slice 18, item 4; prototype `lookupFields`): the relationship of the dictionary it goes through,
 * the warnings (none to choose, or the one chosen is gone, F15), the value for no match and the sentence that reads it.
 */
function LookupFields({
  id,
  index,
  via,
  write,
}: {
  id: Uuid;
  index: MappingIndex;
  via: { value: string; choose: (v: string) => void };
  write: <T extends { notice: string | null }>(send: (v: number) => Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
}) {
  const p = usePanel();
  const m = index.mapping(id)!;
  const relationships = p.ix.model.relationships;
  const candidates = lookupRelationships(index, relationships, id);
  const first = index.inputsOf(id)[0];
  const dictionary = first ? index.entity(index.attribute(first.attribute_id)?.entity_id ?? "") : undefined;
  const gone = lookupRelationshipGone(relationships, m);
  const sentence = lookupSentence(index, relationships, m);
  const ref = (expectedVersion: number) => ({ mappingId: m.id, expectedVersion });
  return (
    <>
      <Field label="Through relationship" htmlFor={VIA_ID}>
        <select
          id={VIA_ID}
          value={gone ? "" : via.value}
          disabled={!p.editable}
          className={inputClass}
          data-testid="select-cube-lookup-via"
          onChange={(e) => via.choose(e.target.value)}
        >
          <option value="">Choose a relationship of {dictionary?.name ?? "?"}…</option>
          {candidates.map((r) => (
            <option key={r.id} value={r.id}>
              {relationshipText(index, r)}
            </option>
          ))}
        </select>
      </Field>
      {/* the one chosen is gone first (F15), and then whether there is another to choose */}
      {gone && (
        <Note warn testId="note-lookup-gone">
          {LOOKUP_RELATIONSHIP_GONE}
        </Note>
      )}
      {!candidates.length && (
        <Note warn testId="note-lookup-none">
          {lookupNoRelationship(dictionary?.name ?? "The dictionary")}
        </Note>
      )}
      <Field label="When no match" htmlFor={NO_MATCH_ID}>
        <TextField
          key={fieldKey(m.id, "lookup_default")}
          id={NO_MATCH_ID}
          value={m.lookup_default ?? ""}
          readOnly={!p.editable}
          placeholder="e.g. Unknown"
          testId="input-cube-lookup-default"
          onSave={(value) => write((v) => updateCubeMappingAction(p.workspaceId, { ...ref(v), lookupDefault: value.trim() ? value : null }))}
          keep={{ key: fieldKey(m.id, "lookup_default"), field: "When no match", object: `the mapping to ${index.attribute(m.attribute_id)?.name ?? "?"}` }}
        />
      </Field>
      {sentence && <Note testId="note-lookup-sentence">{sentence}</Note>}
    </>
  );
}
