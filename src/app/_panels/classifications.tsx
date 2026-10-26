"use client";

// Classifications and notes in the source panels (slice 7c, items 7–15; prototype `togs`, `sourceBody`, `colSections`,
// `renderSettings`, the `[data-imx-note]` handler). A table's or column's section: one toggle per classification of its
// scope, in the groups General, Data Vault 2.0 (only in Data Vault 2.0 mode, P5) and This workspace, and "Edit the
// list…", which opens the workspace's list: add an own one, rename any one, remove any one (its uses, what stops and the
// business key changes that settle shown first, D-47), restore a removed built-in one. The note: plain text saved on
// blur, as a mapping's note (answer F7). Every write is one undo step; reviewers, readers and an archived workspace see
// it all read-only (item 12). Opening the list or toggling is no place in the history (CLAUDE.md, back and forward).

import { useMemo, useState } from "react";
import {
  addClassificationAction,
  removeClassificationAction,
  renameClassificationAction,
  restoreClassificationAction,
  setClassificationAction,
  setSourceNoteAction,
} from "@/app/_actions/classification";
import { useAction } from "@/app/_components/use-action";
import { classificationImpact, type ClassificationImpact } from "@/domain/commands/classification";
import type { Uuid } from "@/domain/ids";
import { byListOrder, groupOf, isDataVault, nameTakenBy, TAKEN_NAME } from "@/domain/model/classifications";
import type { Classification, ClassificationScope } from "@/domain/types";
import { NOTE_REMOVED, NOTE_SAVED } from "@/domain/commands/source";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { buttonClass, dangerClass, Field, Hint, inputClass, LongList, Li, smallButtonClass, TextArea } from "./fields";
import { usePanel } from "./inspector";

type Target = { kind: "source_table" | "source_column"; id: Uuid };
const GROUPS = ["General", "Data Vault 2.0", "This workspace"] as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The toggles of a table or column, with "Edit the list…" (items 13, 14). */
export function ClassificationsSection({ target }: { target: Target }) {
  const p = usePanel();
  const { run } = useAction();
  const [listOpen, setListOpen] = useState(false);
  const scope: ClassificationScope = target.kind === "source_table" ? "table" : "column";
  const classes = p.ix.classes;
  const mine = new Set(classes.of(target.id).map((c) => c.id));
  const shown = classes.list.filter((c) => c.scope === scope && (p.dataVault || !isDataVault(c)));
  const toggle = (c: Classification) =>
    void run(() => setClassificationAction(p.workspaceId, { classificationId: c.id, target, on: !mine.has(c.id) }));
  return (
    <Field label="Classifications">
      <div data-testid="section-classifications">
        {GROUPS.map((group) => {
          const list = shown.filter((c) => groupOf(c) === group);
          if (!list.length) return null;
          return (
            <div key={group} className="mb-2" data-testid="classification-group">
              <div className="mb-1 text-[11.5px] text-im-ink-3">{group}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={mine.has(c.id)}
                    disabled={!p.editable}
                    onClick={() => toggle(c)}
                    data-testid="toggle-classification"
                    className="h-[26px] rounded-[13px] border border-im-line bg-im-surface px-2.5 text-xs text-im-ink-2 hover:border-im-ink-3 disabled:cursor-not-allowed aria-pressed:border-im-physical aria-pressed:bg-im-physical-soft aria-pressed:text-im-physical"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <Hint>
          {scope === "column" && "Yours: a re-import never changes them. "}
          <button type="button" className="text-im-logical underline-offset-2 hover:underline" onClick={() => setListOpen(true)} data-testid="button-edit-classifications">
            Edit the list…
          </button>
        </Hint>
      </div>
      {listOpen && <ClassificationsDialog onClose={() => setListOpen(false)} />}
    </Field>
  );
}

/** A table's or column's note (item 15, P8): plain text, saved on blur, with its toast and Undo. */
export function SourceNote({ target, name, version, value, placeholder, hint }: { target: Target; name: string; version: number; value: string | null; placeholder: string; hint?: string }) {
  const p = usePanel();
  const { run } = useAction();
  const id = target.kind === "source_table" ? "f-table-note" : "f-column-note";
  return (
    <Field label="Note" htmlFor={id}>
      <TextArea
        key={`${target.id}:${version}`}
        id={id}
        value={value ?? ""}
        readOnly={!p.editable}
        placeholder={placeholder}
        data-testid="input-source-note"
        data-version={version}
        onSave={(note) =>
          void run(() => setSourceNoteAction(p.workspaceId, { target, expectedVersion: version, note: note.trim() ? note : null }), (v) => (v.removed ? NOTE_REMOVED(name) : NOTE_SAVED(name)), {
            undoable: true,
          })
        }
      />
      {hint && <Hint>{hint}</Hint>}
    </Field>
  );
}

/** The workspace's classification list (items 7–12; prototype `#setDlg`). Data Vault ones always show (answer F21). */
export function ClassificationsDialog({ onClose }: { onClose: () => void }) {
  const p = usePanel();
  const { run, pending } = useAction();
  const [removing, setRemoving] = useState<Classification | null>(null);
  const all = p.ix.model.classifications;
  const live = p.ix.classes.list;
  const removed = useMemo(() => all.filter((c) => c.deleted_at !== null && c.code !== null).sort(byListOrder), [all]);
  const impact = useMemo<ClassificationImpact | null>(
    () =>
      removing
        ? classificationImpact({ classifications: all, links: p.ix.model.classificationLinks, tables: p.ix.model.sourceTables, columns: p.ix.model.sourceColumns, changes: p.changes }, removing.id)
        : null,
    [removing, all, p.ix.model, p.changes],
  );

  const remove = async (c: Classification) => {
    const r = await run(() => removeClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: c.version }), (v) => `Removed ${v.name} from the list.`, { undoable: true });
    if (r.ok) setRemoving(null);
  };
  const askRemove = (c: Classification) => {
    const u = p.ix.classes.uses(c.id);
    if (u.tables.length + u.columns.length === 0) void remove(c);
    else setRemoving(c);
  };
  const restore = (c: Classification) =>
    void run(() => restoreClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: c.version }), (v) => `Restored ${v.name}.`, { undoable: true });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100vh-32px)] gap-0 overflow-y-auto border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-[560px]"
        data-testid="dialog-classifications"
        // Escape closes the list only: the canvas's own Escape would clear the selection behind it
        onEscapeKeyDown={(e) => e.stopPropagation()}
        // the dialog itself takes the focus, not the first name (a keystroke would rename Business key)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogTitle className="text-base font-semibold">Classifications</DialogTitle>
        <DialogDescription className="mt-2 text-[12.5px] text-im-ink-2">
          One list for the workspace. Data Vault ones show while Data Vault 2.0 mode is on in the workspace settings. An import file may use any of these names in its classifications column.
        </DialogDescription>
        {removing && impact ? (
          <RemoveForm classification={removing} impact={impact} pending={pending} onCancel={() => setRemoving(null)} onRemove={() => void remove(removing)} />
        ) : (
          <>
            {(["column", "table"] as const).map((scope) => (
              <ListSection key={scope} scope={scope} list={live.filter((c) => c.scope === scope)} all={all} onRemove={askRemove} />
            ))}
            {p.editable && <p className="mt-3 text-[12px] text-im-ink-3">A new name is also the name an import file must use; for built-in ones the code (e.g. BK) keeps working.</p>}
            {removed.length > 0 && (
              <section className="mt-4" data-testid="section-removed-classifications">
                <h3 className="mb-1.5 text-[13px] font-semibold">Removed built-in classifications</h3>
                <ul className="divide-y divide-im-line">
                  {removed.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-1.5" data-testid="removed-classification">
                      <span className="flex-1">{c.name}</span>
                      <span className="text-[12px] text-im-ink-3">{c.scope === "table" ? "for tables" : "for columns"}</span>
                      {p.editable && (
                        <button type="button" className={smallButtonClass} onClick={() => restore(c)} data-testid="button-restore-classification">
                          Restore
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "For columns" or "For tables": each row's name (an input to rename it), chips, uses and Remove; then Add. */
function ListSection({ scope, list, all, onRemove }: { scope: ClassificationScope; list: readonly Classification[]; all: readonly Classification[]; onRemove: (c: Classification) => void }) {
  const p = usePanel();
  const { run } = useAction();
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (nameTakenBy(all, scope, n)) return setAddError(TAKEN_NAME);
    const r = await run(() => addClassificationAction(p.workspaceId, { scope, name: n }));
    if (r.ok) {
      setName("");
      setAddError(null);
    } else setAddError(r.message);
  };
  return (
    <section className="mt-4" data-testid={`section-${scope}-classifications`}>
      <h3 className="mb-1.5 text-[13px] font-semibold">{scope === "column" ? "For columns" : "For tables"}</h3>
      <ul className="divide-y divide-im-line">
        {list.map((c) => (
          <Row key={c.id} c={c} all={all} onRemove={() => onRemove(c)} />
        ))}
      </ul>
      {p.editable && (
        <div className="mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void add()}
              placeholder={scope === "column" ? "New column classification, e.g. Hash candidate" : "New table classification, e.g. Golden source"}
              aria-label={scope === "column" ? "New column classification" : "New table classification"}
              aria-invalid={!!addError}
              className={inputClass}
              data-testid={`input-new-${scope}-classification`}
            />
            <button type="button" className={smallButtonClass} onClick={() => void add()} data-testid={`button-add-${scope}-classification`}>
              Add
            </button>
          </div>
          {addError && (
            <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="classification-name-error">
              {addError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ c, all, onRemove }: { c: Classification; all: readonly Classification[]; onRemove: () => void }) {
  const p = usePanel();
  const { run } = useAction();
  const [error, setError] = useState<string | null>(null);
  const u = p.ix.classes.uses(c.id);
  const uses = u.tables.length + u.columns.length;
  const rename = async (input: HTMLInputElement) => {
    const n = input.value.trim();
    if (!n || n === c.name) {
      input.value = c.name;
      return setError(null);
    }
    if (nameTakenBy(all, c.scope, n, c.id)) return setError(TAKEN_NAME);
    const r = await run(() => renameClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: c.version, name: n }));
    if (r.ok) setError(null);
    else setError(r.message);
  };
  return (
    <li className="py-1.5" data-testid="classification-row" data-code={c.code ?? ""}>
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {p.editable ? (
            <input
              key={`${c.id}:${c.version}`}
              type="text"
              defaultValue={c.name}
              aria-label="Name"
              aria-invalid={!!error}
              onBlur={(e) => void rename(e.currentTarget)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={`${inputClass} h-7`}
              data-testid="input-classification-name"
            />
          ) : (
            <span data-testid="classification-name">{c.name}</span>
          )}
          {isDataVault(c) && (
            <span className="whitespace-nowrap rounded-[10px] bg-im-physical-soft px-1.5 text-[11px] text-im-physical" data-testid="chip-data-vault">
              Data Vault 2.0
            </span>
          )}
        </span>
        <span className="whitespace-nowrap text-[12px] text-im-ink-3" data-testid="classification-uses">
          {uses ? `used ${uses}×` : "unused"}
        </span>
        {c.code !== null && <span className="text-[12px] text-im-ink-3">built in</span>}
        {p.editable && (
          <button type="button" className={smallButtonClass} onClick={onRemove} data-testid="button-remove-classification">
            Remove
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="classification-name-error">
          {error}
        </p>
      )}
    </li>
  );
}

/** Removing a classification in use (item 10, D-47): where it is used, what stops, what settles; Remove or Cancel. */
function RemoveForm({ classification: c, impact, pending, onCancel, onRemove }: { classification: Classification; impact: ClassificationImpact; pending: boolean; onCancel: () => void; onRemove: () => void }) {
  const uses = [...impact.tables.map((t) => ({ ...t, kind: "table" })), ...impact.columns.map((x) => ({ ...x, kind: "column" }))];
  return (
    <div className="mt-4" data-testid="form-remove-classification">
      <p className="font-medium" data-testid="remove-classification-uses">
        {c.name} is used on {plural(impact.tables.length, "table")} and {plural(impact.columns.length, "column")}.
      </p>
      <div className="mt-2">
        <LongList items={uses} text={(x) => x.label} testId="list-classification-uses" render={(x) => <Li key={x.id} testId="classification-use"><span className="font-mono text-xs">{x.label}</span></Li>} />
      </div>
      {impact.stops && (
        <p className="mt-2.5 text-im-ink-2" data-testid="remove-classification-stops">
          {impact.stops}
        </p>
      )}
      {impact.settles > 0 && (
        <p className="mt-2 text-im-ink-2" data-testid="remove-classification-settles">
          {plural(impact.settles, "open business key change")} without a mapping {impact.settles === 1 ? "settles" : "settle"}.
        </p>
      )}
      <p className="mt-2 text-[12px] text-im-ink-3">You can undo it right after.</p>
      <DialogFooter className="mt-4">
        <button type="button" className={buttonClass} onClick={onCancel} data-testid="button-cancel-remove-classification">
          Cancel
        </button>
        <button type="button" className={dangerClass} disabled={pending} onClick={onRemove} data-testid="button-confirm-remove-classification">
          Remove
        </button>
      </DialogFooter>
    </div>
  );
}
