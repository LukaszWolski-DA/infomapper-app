"use client";

// The requirement panel (slice 4a, PRD items 23–27, prototype insReq): ID and kind, name, description (rich text with
// its kind's template), Rule or Check and “When it fails” by kind, status and priority, owner and external reference,
// “Part of” (never a cycle) and “Broken down into”, coverage with its gaps, what it traces to, and “Delete
// requirement”. Reviewers change the status only; readers and archived workspaces nothing. Slice 4b-2 (items 7, 13):
// “Place its card on this canvas” or “Remove its card from this canvas”. Everything comes from the requirement index.

import { useContext, useEffect, useRef, useState } from "react";
import { deleteRequirementAction, setRequirementStatusAction, unlinkRequirementAction, updateRequirementAction } from "@/app/_actions/requirement";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { UpdateRequirementInput } from "@/domain/commands/requirement";
import { targetOf } from "@/domain/model/labels";
import { templateHtml } from "@/domain/model/requirement-templates";
import { coverageText } from "./requirement-ui";
import { coverageParts, ENTITY_GAP_REASON, fourEyesRequirementMessage, KIND_NAMES, PRIORITY_NAMES, STATUS_NAMES, usesExpression, usesSeverity } from "@/domain/model/requirements";
import { REQUIREMENT_KINDS, REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES, type Requirement, type RequirementLink } from "@/domain/types";
import { RichTextField } from "@/ui/rich-text/rich-text-field";
import { Actions, buttonClass, dangerClass, Field, Hint, inputClass, Kind, List, Note, Section, Seg, TextArea, TextField } from "./fields";
import { usePanel } from "./inspector";
import { attributeLabel, columnLabel, inputsLabel } from "./model-index";
import { usePanels } from "./panels-context";
import { requirementNameFocus } from "./requirements-section";

type Field = UpdateRequirementInput["field"];
type Value<F extends Field> = Extract<UpdateRequirementInput, { field: F }>["value"];

const TYPE: Record<string, string> = { entity: "entity", attribute: "attribute", mapping: "mapping", source_table: "table", source_column: "column" };

export function RequirementPanel({ requirement: r }: { requirement: Requirement }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const { nameFocus, setNameFocus } = usePanels();
  /** Bumped after a refusal, so the fields show the stored values again. An empty key or name goes to the server, which
   * refuses it with “Enter a key.” / “Enter a name.” (PRD item 2, S4A-02). */
  const [reset, setReset] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const ix = p.ix;
  const coverage = p.rx.coverage(r.id);
  const links = p.rx.linksOf(r.id);
  const children = p.rx.children(r.id);

  useEffect(() => {
    if (nameFocus !== requirementNameFocus(r.id)) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, r.id, setNameFocus]);

  async function save<F extends Field>(field: F, value: Value<F>): Promise<boolean> {
    const result = await run(() => updateRequirementAction(p.workspaceId, { requirementId: r.id, expectedVersion: r.version, field, value } as UpdateRequirementInput));
    if (!result.ok) setReset((n) => n + 1);
    return result.ok;
  }
  const setStatus = (status: string) =>
    void run(() => setRequirementStatusAction(p.workspaceId, { requirementId: r.id, expectedVersion: r.version, status }));
  async function remove() {
    const result = await run(() => deleteRequirementAction(p.workspaceId, { requirementId: r.id, expectedVersion: r.version }), (v) => v.message, { undoable: true });
    if (result.ok) ui.select(null);
  }
  const unlink = (k: RequirementLink) =>
    void run(() => unlinkRequirementAction(p.workspaceId, { requirementLinkId: k.id, expectedVersion: k.version }), "Unlinked.", { undoable: true });

  // “Part of”: every requirement that is not this one or below it
  const below = new Set<string>([r.id]);
  const queue = [r.id];
  while (queue.length) {
    for (const c of p.rx.children(queue.shift()!)) {
      if (below.has(c.id)) continue;
      below.add(c.id);
      queue.push(c.id);
    }
  }
  const parents = p.rx.requirements.filter((x) => !below.has(x.id));

  // slice 4b-1 (PRD item 11): entity items first, then attribute items as before; a click goes to the element
  const gaps = [
    ...coverage.entityGaps.map((id) => ({ id, why: ENTITY_GAP_REASON, label: ix.entity.get(id)?.name ?? "", go: () => p.goEntity(id) })),
    ...coverage.notMapped.map((id) => ({ id, why: "unmapped", label: attributeLabel(ix, id), go: () => p.goAttribute(id) })),
    ...coverage.notApproved.map((id) => ({ id, why: "not approved", label: attributeLabel(ix, id), go: () => p.goAttribute(id) })),
  ];
  const traced = (k: RequirementLink) => {
    const t = targetOf(k);
    if (!t) return null;
    const name =
      t.kind === "entity"
        ? ix.entity.get(t.id)?.name
        : t.kind === "attribute"
          ? ix.attribute.has(t.id) && attributeLabel(ix, t.id)
          : t.kind === "mapping"
            ? ix.mapping.has(t.id) && `${inputsLabel(ix, t.id)} → ${attributeLabel(ix, ix.mapping.get(t.id)!.attribute_id)}`
            : t.kind === "source_table"
              ? ix.table.get(t.id)?.name
              : ix.column.has(t.id) && columnLabel(ix, t.id);
    if (!name) return null;
    const go = { entity: p.goEntity, attribute: p.goAttribute, mapping: p.goMapping, source_table: p.goTable, source_column: p.goColumn }[t.kind];
    return { name, type: TYPE[t.kind]!, go: () => go(t.id), mono: t.kind !== "entity" && t.kind !== "attribute" };
  };
  const v = `${r.id}:${r.version}:${reset}`;
  const kindName = KIND_NAMES[r.kind].toLowerCase();

  return (
    <div data-testid="panel-requirement" data-version={r.version}>
      <Kind>Requirement</Kind>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="ID" htmlFor="f-rqk">
          <TextField key={v} id="f-rqk" value={r.key} mono readOnly={!p.editable} onSave={(key) => void save("key", key)} testId="input-req-key" />
        </Field>
        <Field label="Kind" htmlFor="f-rqkind">
          <select key={v} id="f-rqkind" className={inputClass} defaultValue={r.kind} disabled={!p.editable} onChange={(e) => void save("kind", e.target.value as Requirement["kind"])} data-testid="select-req-kind">
            {REQUIREMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_NAMES[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Name" htmlFor="f-rqn">
        <TextField key={v} id="f-rqn" inputRef={nameRef} value={r.name} readOnly={!p.editable} onSave={(name) => void save("name", name)} testId="input-req-name" />
      </Field>
      <RichTextField
        key={`d:${v}`}
        label="Description"
        html={r.description_html}
        text={r.description_text}
        empty={`No description yet. Click to write it; a ${kindName} template guides you.`}
        editable={p.editable}
        subtitle={`${r.key} · ${KIND_NAMES[r.kind]}`}
        title={`${r.name}: description`}
        template={templateHtml(r.kind)}
        onSave={(html) => save("description", html)}
        testId="field-req-description"
      />
      {usesExpression(r.kind) && (
        <Field label={r.kind === "dq_rule" ? "Check" : "Rule"} htmlFor="f-rqe">
          <TextArea
            key={v}
            id="f-rqe"
            code
            value={r.expression ?? ""}
            readOnly={!p.editable}
            placeholder="An expression or plain words"
            onSave={(text) => void save("expression", text)}
            data-testid="input-req-expression"
          />
        </Field>
      )}
      {usesSeverity(r.kind) && (
        <Field label="When it fails">
          <Seg value={r.severity ?? "warn"} options={[["warn", "Warn"], ["block", "Block the load"]] as const} disabled={!p.editable} onChange={(s) => void save("severity", s)} testId="seg-req-severity" />
        </Field>
      )}
      <Field label="Status">
        <Seg value={r.status} options={REQUIREMENT_STATUSES.map((s) => [s, STATUS_NAMES[s]] as const)} disabled={!p.canSetStatus} onChange={setStatus} testId="seg-req-status" />
      </Field>
      {/* as the mapping panel's four-eyes note: Agreed stays clickable, the server refuses (AD-06) */}
      {p.fourEyes && p.canSetStatus && r.status !== "agreed" && p.requirementAuthors[r.id] === p.userId && (
        <Note warn testId="note-req-four-eyes">
          {fourEyesRequirementMessage(r.key)}
        </Note>
      )}
      <Field label="Priority">
        <Seg value={r.priority} options={REQUIREMENT_PRIORITIES.map((s) => [s, PRIORITY_NAMES[s]] as const)} disabled={!p.editable} onChange={(s) => void save("priority", s)} testId="seg-req-priority" />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Owner" htmlFor="f-rqo">
          <TextField key={v} id="f-rqo" value={r.owner_name ?? ""} readOnly={!p.editable} onSave={(owner) => void save("owner_name", owner || null)} testId="input-req-owner" />
        </Field>
        <Field label="External reference" htmlFor="f-rqr">
          <TextField key={v} id="f-rqr" value={r.external_ref ?? ""} readOnly={!p.editable} placeholder="e.g. JIRA-481" onSave={(ref) => void save("external_ref", ref || null)} testId="input-req-ref" />
        </Field>
      </div>
      <Field label="Part of" htmlFor="f-rqp">
        <select key={v} id="f-rqp" className={inputClass} defaultValue={r.parent_id ?? ""} disabled={!p.editable} onChange={(e) => void save("parent_id", e.target.value || null)} data-testid="select-req-parent">
          <option value="">None (top level)</option>
          {parents.map((x) => (
            <option key={x.id} value={x.id}>
              {`${x.key}  ${x.name}`}
            </option>
          ))}
        </select>
      </Field>
      {children.length > 0 && (
        <p className="mt-1.5 text-im-ink-2" data-testid="text-req-children">
          Broken down into{" "}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <button type="button" className="font-mono text-im-req hover:underline" onClick={() => p.goRequirement(c.id)} data-testid="link-req-child">
                {c.key}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      <Section>Coverage</Section>
      {/* slice 4b-1 (PRD items 10–11): coverage counts items, entities and attributes; the tooltip names the parts */}
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-im-ink-2" data-testid="grid-req-coverage">
        <span>In scope</span>
        <span className="text-right font-semibold text-im-ink" title={coverageParts(coverage.parts)} data-testid="text-req-coverage">
          {coverageText(coverage.covered.length, coverage.total)}
        </span>
        {coverage.parts.entities > 0 && (
          <>
            <span>Entities without an approved mapping</span>
            <span className="text-right">{coverage.entityGaps.length}</span>
          </>
        )}
        <span>Mapped, not approved yet</span>
        <span className="text-right">{coverage.notApproved.length}</span>
        <span>Not mapped</span>
        <span className="text-right">{coverage.notMapped.length}</span>
      </div>
      {gaps.length > 0 && (
        <List testId="list-req-gaps">
          {gaps.map((g) => (
            <button key={g.id} type="button" className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover" onClick={g.go} data-testid="item-req-gap" data-why={g.why}>
              <span className={`size-2.5 flex-none rounded-full ${g.why === "not approved" ? "bg-im-warn" : "shadow-[inset_0_0_0_1.5px_var(--im-ink-3)]"}`} />
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{g.why}</span>
            </button>
          ))}
        </List>
      )}

      <Section>Traces to</Section>
      {links.length ? (
        <List testId="list-req-traces">
          {links.map((k) => {
            const t = traced(k);
            if (!t) return null;
            return (
              <div key={k.id} className="flex items-center gap-1 rounded-md hover:bg-im-hover" data-testid="item-req-trace" data-type={t.type}>
                <button type="button" className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left ${t.mono ? "font-mono text-xs" : ""}`} onClick={t.go}>
                  {t.name}
                </button>
                <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{t.type}</span>
                {p.editable && (
                  <button type="button" className="mr-1 grid size-6 flex-none place-items-center rounded text-im-ink-3 hover:bg-im-surface hover:text-im-warn" aria-label="Unlink" title="Unlink" onClick={() => unlink(k)} data-testid="button-trace-unlink">
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </List>
      ) : (
        <Hint>Nothing yet. Link it from the panel of an entity, attribute, mapping, table or column.</Hint>
      )}

      {p.editable && (
        <Actions>
          {ui.requirementCard(r.id) ? (
            <button type="button" className={buttonClass} onClick={() => ui.removeRequirementCard(r.id)} data-testid="button-requirement-uncard">
              Remove its card from this canvas
            </button>
          ) : (
            <button type="button" className={buttonClass} onClick={() => ui.placeRequirementCard(r.id)} data-testid="button-requirement-card">
              Place its card on this canvas
            </button>
          )}
          <button type="button" className={dangerClass} onClick={() => void remove()} data-testid="button-delete-requirement">
            Delete requirement
          </button>
        </Actions>
      )}
    </div>
  );
}
