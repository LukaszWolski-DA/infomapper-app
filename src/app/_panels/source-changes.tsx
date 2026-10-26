"use client";

// Changes to resolve on the system's and the table's panels (slice 7b, items 10–21; prototype `issuesHtml`,
// `issueImpact`, `issueCard`, `pendingHtml`): the open changes high first, each a card with its severity, title, label
// (a link to its column or table while that exists), date, detail, impact and actions; “Move its mappings…”, “Map to an
// attribute…” and “Delete…” open a form in the card that shows what happens before anything does (P5, D-47). The
// system panel adds the resolved history and, per import, “Approve again all {n}” (P9). Every action is one server
// command, one undo step, and ends with the toast “{resolution}: {label}” with Undo (item 19).
//   Who sees which buttons (F22): approving again and leaving in review need the mapping status right (reviewers too);
//   every other action needs editing. The server checks again.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  acknowledgeChangeAction,
  approveChangeAgainAction,
  approveImportAgainAction,
  deleteChangeObjectAction,
  leaveChangeInReviewAction,
  mapChangeColumnAction,
  markChangeNotNeededAction,
  moveChangeMappingsAction,
  retireChangeAction,
  sourceDeleteImpactAction,
  splitChangeAction,
} from "@/app/_actions/source-change";
import { useAction } from "@/app/_components/use-action";
import type { ActionResult } from "@/app/_lib/run-command";
import type { ChangeOutcome } from "@/domain/commands/source-change";
import type { Uuid } from "@/domain/ids";
import { actionsFor, approveAllPlan, movePlan, moveTargets, type ChangeActionRows } from "@/domain/source-changes/actions";
import { coverageChangeText } from "@/domain/source-changes/coverage";
import type { SourceDeleteImpact } from "@/domain/source-changes/delete";
import { byPriority, isOpen } from "@/domain/source-changes/rules";
import {
  ACTION_LABEL,
  DELETE_RETIRE_HINT,
  FOUR_EYES_CARD,
  FOUR_EYES_HEAD,
  isoDate,
  KIND_TITLE,
  MAP_HINT,
  MOVE_HINT,
  NO_COVERAGE_CHANGE,
  NONE_NEEDED_LABEL,
  NOT_FIT_HEAD,
  REVIEW_SENT_BACK,
  STATUS_WORD,
  type SourceChangeAction,
} from "@/domain/source-changes/texts";
import type { SourceChange, Workspace } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { Hint, inputClass, smallButtonClass } from "./fields";
import { impactIndex, plural } from "./import/wizard-model";
import { usePanel } from "./inspector";
import { attributeLabel, attributeOptions, mappingsOfColumn } from "./model-index";

const primarySmall = "h-[26px] rounded-md border border-im-logical bg-im-logical px-[9px] text-xs font-medium text-im-surface disabled:opacity-50";
const dangerSmall = `${smallButtonClass} border-im-warn text-im-warn disabled:opacity-50`;
const pendClass = "mt-2.5 grid gap-2 rounded-md bg-im-panel px-3 py-2.5";
const ReqTag = ({ children }: { children: string }) => (
  <span className="mr-1 rounded bg-im-req-soft px-1.5 text-[11px] font-medium text-im-req-ink" data-testid="change-requirement">
    {children}
  </span>
);

/** The rows the domain's change rules read, from the page's model and changes. */
export function useChangeRows(): ChangeActionRows {
  const p = usePanel();
  return useMemo(
    () => ({
      tables: p.ix.model.sourceTables,
      columns: p.ix.model.sourceColumns,
      mappings: p.ix.model.mappings,
      mappingInputs: p.ix.model.mappingInputs,
      attributes: p.ix.model.attributes,
      entities: p.ix.model.entities,
      changes: p.changes,
    }),
    [p.ix, p.changes],
  );
}

const toastText = (o: ChangeOutcome) => `${o.resolution}: ${o.label}`;

/**
 * Open changes high first (“Nothing to resolve.” without), and with `history` the resolved ones folded: “{n} resolved
 * changes”, each with its resolution, who and when (item 20). The table panel shows the open ones only (item 21).
 */
export function ChangesList({ changes, history }: { changes: readonly SourceChange[]; history: boolean }) {
  const p = usePanel();
  const keys = useMemo(() => impactIndex({ model: p.ix.model, requirements: p.requirements, requirementLinks: p.requirementLinks }).keysOfAttribute, [p.ix, p.requirements, p.requirementLinks]);
  const open = changes.filter(isOpen).sort(byPriority);
  const done = changes.filter((c) => c.deleted_at === null && c.status === "resolved").sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
  return (
    <>
      {open.length ? (
        <div data-testid="list-changes">
          {open.map((c) => (
            <ChangeCard key={c.id} change={c} keys={keys} />
          ))}
        </div>
      ) : (
        <Hint>
          <span data-testid="changes-none">Nothing to resolve.</span>
        </Hint>
      )}
      {history && done.length > 0 && (
        <details className="mt-1.5" data-testid="changes-resolved">
          <summary className="my-1.5 cursor-pointer text-im-ink-2">{plural(done.length, "resolved change")}</summary>
          <ul>
            {done.map((c) => (
              <li key={c.id} className="border-b border-im-line py-[7px] text-[12.5px]" data-testid="resolved-change" data-change={c.id}>
                <b>{KIND_TITLE[c.kind]}</b> · <span className="font-mono">{c.object_label}</span>
                <br />
                <span className="text-im-ink-3">
                  {c.resolution} · {p.people[c.resolved_by ?? ""] ?? "someone"} · {isoDate(c.resolved_at ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** What the change touches (prototype `issueImpact`): the mappings on its column, a table's mappings, its canvases. */
function Impact({ change: c, keys }: { change: SourceChange; keys: ReadonlyMap<string, ReadonlySet<string>> }) {
  const p = usePanel();
  const lines: ReactNode[] = [];
  if (c.source_column_id && p.ix.column.has(c.source_column_id)) {
    for (const m of mappingsOfColumn(p.ix, c.source_column_id)) {
      const reqs = [...(keys.get(m.attribute_id) ?? [])];
      lines.push(
        <span key={m.id}>
          Feeds {attributeLabel(p.ix, m.attribute_id)} ({STATUS_WORD[m.status]}){reqs.length > 0 && " "}
          {reqs.map((k) => (
            <ReqTag key={k}>{k}</ReqTag>
          ))}
        </span>,
      );
    }
  }
  if (c.kind === "table_left" && c.source_table_id) {
    const columns = new Set((p.ix.columnsOf.get(c.source_table_id) ?? []).map((x) => x.id));
    const n = p.ix.model.mappings.filter((m) => (p.ix.inputsOf.get(m.id) ?? []).some((i) => columns.has(i.source_column_id))).length;
    lines.push(<span key="table">{n ? `${plural(n, "mapping")} on its columns` : "No mappings on its columns"}</span>);
  }
  const canvases = c.source_table_id ? (p.canvasesOf[c.source_table_id] ?? []).map((id) => p.places.find((x) => x.id === id)?.name).filter(Boolean) : [];
  if (canvases.length) lines.push(<span key="canvases">On {[...new Set(canvases)].join(", ")}</span>);
  if (!lines.length) return null;
  return (
    <p className="mt-1 text-xs text-im-ink-2" data-testid="change-impact">
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {l}
        </span>
      ))}
    </p>
  );
}

type Form = "move" | "map" | "delete";
const FORMS: ReadonlySet<SourceChangeAction> = new Set<SourceChangeAction>(["move", "map", "delete"]);
const DIRECT: Partial<Record<SourceChangeAction, (workspaceId: string, input: { changeId: Uuid; expectedVersion: number }) => Promise<ActionResult<ChangeOutcome>>>> = {
  retire: retireChangeAction,
  not_needed: markChangeNotNeededAction,
  split: splitChangeAction,
  approve: approveChangeAgainAction,
  leave: leaveChangeInReviewAction,
  acknowledge: acknowledgeChangeAction,
};

function ChangeCard({ change: c, keys }: { change: SourceChange; keys: ReadonlyMap<string, ReadonlySet<string>> }) {
  const p = usePanel();
  const rows = useChangeRows();
  const { run, pending } = useAction();
  const [form, setForm] = useState<Form | null>(null);
  const ref = { changeId: c.id, expectedVersion: c.version };
  // approving again and leaving in review answer a review (reviewers too); the rest edits the model (F22)
  const acts = actionsFor(rows, c).filter((a) => (a === "approve" || a === "leave" ? p.canSetStatus : p.editable));
  const act = (a: SourceChangeAction) => {
    if (FORMS.has(a)) return setForm(a as Form);
    const call = DIRECT[a];
    if (call) void run(() => call(p.workspaceId, ref), toastText, { undoable: true });
  };
  const finish = (r: ActionResult<ChangeOutcome>) => {
    if (r.ok) setForm(null);
  };
  // four-eyes (Łukasz's step 4 answer 1): a button the server would refuse shows disabled with the reason, as the
  // mapping panel's approval (`fourEyesBlocks` there); the server still checks
  const blocked = acts.includes("approve") && p.fourEyes && !!c.mapping_id && p.contentAuthors[c.mapping_id] === p.userId;
  const byImport = blocked && p.imports.some((i) => i.id === c.source_import_id && i.byId === p.userId);

  const column = c.source_column_id ? p.ix.column.get(c.source_column_id) : undefined;
  const table = c.source_table_id ? p.ix.table.get(c.source_table_id) : undefined;
  // the label links to what it names while that exists (Q9): the column, or for a table kind the table
  const go = column ? () => p.goColumn(column.id) : table && !c.source_column_id ? () => p.goTable(table.id) : null;

  return (
    <article
      className={`mb-2 rounded-lg border border-im-line bg-im-surface px-3 py-2.5 ${c.severity === "high" ? "border-l-[3px] border-l-im-warn" : ""}`}
      data-testid="change-card"
      data-change={c.id}
      data-kind={c.kind}
      data-severity={c.severity}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`rounded px-1.5 text-[11px] font-medium ${c.severity === "high" ? "bg-im-warn text-im-surface" : "bg-im-hover text-im-ink-2"}`}>
          {c.severity === "high" ? "High" : "Normal"}
        </span>
        <b className="font-semibold" data-testid="change-title">
          {KIND_TITLE[c.kind]}
        </b>
        {go ? (
          <button type="button" className="font-mono text-xs text-im-logical hover:underline" onClick={go} data-testid="change-label">
            {c.object_label}
          </button>
        ) : (
          <span className="font-mono text-xs" data-testid="change-label">
            {c.object_label}
          </span>
        )}
        <span className="text-xs text-im-ink-3">{isoDate(c.created_at)}</span>
      </header>
      <p className="mt-1 text-im-ink-2" data-testid="change-detail">
        {c.detail}
      </p>
      <Impact change={c} keys={keys} />
      {form === "move" && <MoveForm change={c} rows={rows} onCancel={() => setForm(null)} onMove={(targetColumnId) => void run(() => moveChangeMappingsAction(p.workspaceId, { ...ref, targetColumnId }), toastText, { undoable: true }).then(finish)} pending={pending} />}
      {form === "map" && <MapForm change={c} onCancel={() => setForm(null)} onMap={(attributeId) => void run(() => mapChangeColumnAction(p.workspaceId, { ...ref, attributeId }), toastText, { undoable: true }).then(finish)} pending={pending} />}
      {form === "delete" && (
        <SourceDeleteForm
          target={c.kind === "table_left" ? { tableId: c.source_table_id! } : { columnId: c.source_column_id! }}
          retireHint
          pending={pending}
          onCancel={() => setForm(null)}
          onDelete={() => void run(() => deleteChangeObjectAction(p.workspaceId, ref), toastText, { undoable: true }).then(finish)}
        />
      )}
      {!form && acts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {acts.map((a) => (
            <button
              key={a}
              type="button"
              className={`${smallButtonClass} disabled:opacity-50`}
              disabled={pending || (a === "approve" && blocked)}
              onClick={() => act(a)}
              data-testid={`change-action-${a}`}
            >
              {a === "not_needed" && c.kind === "new_table" ? NONE_NEEDED_LABEL : ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
      {!form && blocked && (
        <p className="mt-1.5 text-xs text-im-warn" data-testid="change-four-eyes">
          {FOUR_EYES_CARD(byImport)}
        </p>
      )}
    </article>
  );
}

const FormButtons = ({ label, onGo, onCancel, disabled, danger, testId }: { label: string; onGo: () => void; onCancel: () => void; disabled?: boolean; danger?: boolean; testId: string }) => (
  <div className="flex gap-1.5">
    <button type="button" className={danger ? dangerSmall : primarySmall} disabled={disabled} onClick={onGo} data-testid={testId}>
      {label}
    </button>
    <button type="button" className={smallButtonClass} onClick={onCancel} data-testid="button-form-cancel">
      Cancel
    </button>
  </div>
);

/**
 * “Move its mappings…” (item 12, Q5): the system's present columns, the same table first, each with its type; what
 * happens to each mapping before the click: back to review, the rule after, and an input that is removed because the
 * mapping already reads the target (question 8); a duplicate is refused with its reason.
 */
function MoveForm({ change, rows, onMove, onCancel, pending }: { change: SourceChange; rows: ChangeActionRows; onMove: (targetId: Uuid) => void; onCancel: () => void; pending: boolean }) {
  const p = usePanel();
  const groups = useMemo(() => moveTargets(rows, change), [rows, change]);
  const [target, setTarget] = useState(groups[0]?.columns[0]?.id ?? "");
  const plan = target ? movePlan(rows, change, target) : null;
  const from = change.source_column_id ? p.ix.column.get(change.source_column_id) : undefined;
  const n = from ? mappingsOfColumn(p.ix, from.id).length : 0;
  return (
    <div className={pendClass} data-testid="form-move">
      <label className="grid gap-1">
        <span>
          Move {plural(n, "mapping")} from <span className="font-mono">{from?.name ?? change.object_label}</span> to
        </span>
        <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} data-testid="select-move-target">
          {groups.map((g) => (
            <optgroup key={g.table.id} label={`${g.table.schema_name}.${g.table.name}`}>
              {g.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.type}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {plan && !plan.ok && (
        <p className="text-im-warn" data-testid="move-refused">
          {plan.error.message}
        </p>
      )}
      {plan?.ok && plan.steps.length > 0 && (
        <ul className="text-xs text-im-ink-2" data-testid="move-steps">
          {plan.steps.map((s) => (
            <li key={s.mapping.id} data-testid="move-step">
              {s.attribute} ({STATUS_WORD[s.mapping.status]}){s.backToReview && ", goes back to review"}
              {s.ruleAfter !== null && s.ruleAfter !== s.mapping.rule_expression && (
                <>
                  ; rule <span className="font-mono">{s.ruleAfter}</span>
                </>
              )}
              {s.note && <span className="block text-im-warn">{s.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="text-xs text-im-ink-3">{MOVE_HINT}</span>
      <FormButtons label="Move" onGo={() => onMove(target)} onCancel={onCancel} disabled={pending || !plan?.ok} testId="button-move" />
    </div>
  );
}

/** “Map to an attribute…” (item 14): attributes by entity with their types; the mapping starts as a draft. */
function MapForm({ change, onMap, onCancel, pending }: { change: SourceChange; onMap: (attributeId: Uuid) => void; onCancel: () => void; pending: boolean }) {
  const p = usePanel();
  const groups = useMemo(() => attributeOptions(p.ix, p.entitiesHere), [p.ix, p.entitiesHere]);
  const [attribute, setAttribute] = useState(groups[0]?.columns[0]?.id ?? "");
  const column = change.source_column_id ? p.ix.column.get(change.source_column_id) : undefined;
  return (
    <div className={pendClass} data-testid="form-map">
      <label className="grid gap-1">
        <span>
          Map <span className="font-mono">{column?.name ?? change.object_label}</span> to
        </span>
        <select className={inputClass} value={attribute} onChange={(e) => setAttribute(e.target.value)} data-testid="select-map-attribute">
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.columns.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <span className="text-xs text-im-ink-3">{MAP_HINT}</span>
      <FormButtons label="Map" onGo={() => onMap(attribute)} onCancel={onCancel} disabled={pending || !attribute} testId="button-map" />
    </div>
  );
}

/**
 * The delete form (D-47, item 13; step 1 answer Q7): what goes with a source table or column, read on the server, before
 * anything happens: its mappings (attribute, status, deleted or losing this input), relationships, a table's columns
 * and canvas cards, and each requirement whose coverage changes, or “No requirement’s coverage changes.”. A change's
 * “Delete…” and the table panel's “Delete table…” both show it.
 */
export function SourceDeleteForm({
  target,
  retireHint,
  onDelete,
  onCancel,
  pending,
}: {
  target: { tableId: Uuid } | { columnId: Uuid };
  /** “Retiring keeps the history instead; …” for what left the source. */
  retireHint: boolean;
  onDelete: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const p = usePanel();
  const toast = useToast();
  const [impact, setImpact] = useState<SourceDeleteImpact | null>(null);
  const key = "tableId" in target ? `t:${target.tableId}` : `c:${target.columnId}`;
  // read once per target; the parent may re-render with new callbacks meanwhile
  const refusal = useRef({ toast, onCancel });
  useEffect(() => {
    refusal.current = { toast, onCancel };
  });
  useEffect(() => {
    let live = true;
    const [kind, id] = [key.slice(0, 1), key.slice(2)];
    void sourceDeleteImpactAction(p.workspaceId, kind === "t" ? { tableId: id } : { columnId: id }).then((r) => {
      if (!live) return;
      if (r.ok) setImpact(r.value);
      else {
        refusal.current.toast(r.message, "refusal");
        refusal.current.onCancel();
      }
    });
    return () => {
      live = false;
    };
  }, [p.workspaceId, key]);

  if (!impact) {
    return (
      <div className={pendClass} data-testid="form-delete">
        <span className="text-im-ink-3">Counting what goes with it…</span>
      </div>
    );
  }
  const what = impact.what === "table" ? "the table" : "the column";
  return (
    <div className={pendClass} data-testid="form-delete">
      <b>
        Delete {what} <span className="font-mono">{impact.label}</span> with:
      </b>
      <ul className="grid gap-0.5 text-xs">
        <li data-testid="delete-mappings">
          {impact.mappings.length
            ? `${plural(impact.mappings.length, "mapping")}: ${impact.mappings.map((m) => `${m.attribute} (${STATUS_WORD[m.status]})${m.effect === "loses this input" ? ", loses this input" : ""}`).join(", ")}`
            : "no mappings"}
        </li>
        {impact.relationships.length > 0 && (
          <li data-testid="delete-relationships">
            {plural(impact.relationships.length, "relationship")}: {impact.relationships.map((r) => r.name).join(", ")}
          </li>
        )}
        {impact.what === "table" && <li data-testid="delete-columns">{plural(impact.columns, "column")}</li>}
        {impact.canvases.length > 0 && <li data-testid="delete-canvases">its cards on {impact.canvases.map((c) => c.name).join(", ")}</li>}
      </ul>
      {impact.coverage.length ? (
        <ul className="grid gap-0.5 text-xs" data-testid="delete-coverage">
          {impact.coverage.map((d) => (
            <li key={d.requirement.id}>
              <ReqTag>{d.requirement.key}</ReqTag>
              {coverageChangeText(d)}
              {d.why.length > 0 && <span className="text-im-ink-3"> · {d.why.join("; ")}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-im-ink-3" data-testid="delete-coverage-none">
          {NO_COVERAGE_CHANGE}
        </span>
      )}
      {retireHint && <span className="text-xs text-im-ink-3">{DELETE_RETIRE_HINT}</span>}
      <FormButtons label="Delete" danger onGo={onDelete} onCancel={onCancel} disabled={pending} testId="button-delete-confirm" />
    </div>
  );
}

/**
 * “Approve again all {n}” for one import (item 17, P9, Q11): the mappings it sent back that are still in review. The
 * entry “Review the {n} sent back…” counts all of them and opens the list (Łukasz's step 4 answer 2): their reasons,
 * those that don't fit the source listed apart first, then those four-eyes keeps from this person; only the confirm
 * button “Approve {k}” counts what it approves, one undo step, disabled at 0.
 */
export function ApproveAgainAll({ importId }: { importId: Uuid }) {
  const p = usePanel();
  const rows = useChangeRows();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  // the plan reads only the four-eyes switch of the workspace; the server plans again from its own data
  const plan = useMemo(
    () => approveAllPlan(rows, importId, { four_eyes: p.fourEyes } as Workspace, p.userId, (id) => p.contentAuthors[id] ?? ""),
    [rows, importId, p.fourEyes, p.userId, p.contentAuthors],
  );
  const total = plan.approve.length + plan.notFit.length + plan.refused.length;
  if (!total || !p.canSetStatus) return null;
  if (!open) {
    return (
      <button type="button" className={`${smallButtonClass} mt-1 block`} onClick={() => setOpen(true)} data-testid="button-approve-all">
        {REVIEW_SENT_BACK(total)}
      </button>
    );
  }
  const n = plan.approve.length;
  return (
    <div className={pendClass} data-testid="form-approve-all">
      {n > 0 && (
        <ul className="text-xs" data-testid="approve-all-list">
          {plan.approve.map((e) => (
            <li key={e.mapping.id} data-testid="approve-all-entry">
              <b>{e.attribute}</b>: {e.reason}
            </li>
          ))}
        </ul>
      )}
      {plan.notFit.length > 0 && (
        <div className="text-xs" data-testid="approve-all-not-fit">
          <span className="text-im-warn">{NOT_FIT_HEAD}</span>
          <ul>
            {plan.notFit.map((e) => (
              <li key={e.mapping.id}>
                <b>{e.attribute}</b>: {e.why.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.refused.length > 0 && (
        <div className="text-xs" data-testid="approve-all-four-eyes">
          <span className="text-im-warn">{FOUR_EYES_HEAD}</span>
          <ul>
            {plan.refused.map((e) => (
              <li key={e.mapping.id}>
                <b>{e.attribute}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormButtons
        label={`Approve ${n}`}
        disabled={pending || !n}
        onCancel={() => setOpen(false)}
        onGo={() =>
          void run(() => approveImportAgainAction(p.workspaceId, { importId, count: n }), toastText, { undoable: true }).then((r) => {
            if (r.ok) setOpen(false);
          })
        }
        testId="button-approve-all-confirm"
      />
    </div>
  );
}
