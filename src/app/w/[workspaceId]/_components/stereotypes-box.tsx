"use client";

// The Metadata conventions tab's "Entity stereotypes" box (slice 24, items 1–8, D-79; prototype `stSection`, `stRemove`):
// the workspace's list, between Classifications and Concept colours. Each row: its name (saved on leaving it, D-66's
// draft; a taken name refused with the message under the field, F8), its code, its definition (plain text, saved on
// leaving it, with the classifications' toasts, F9), its uses (live logical entities) and, for an own one, Remove. The
// Add row proposes the code from the name until the code is edited by hand (F6). Removing an unused own one is at once,
// with Undo; a used one opens a dialog that asks which stereotype its entities get. Each change is one undo step; owners,
// admins and modelers in a workspace that is not archived edit it, everyone else reads it. Nothing here reads layout.

import { useMemo, useState } from "react";
import { addStereotypeAction, removeStereotypeAction, renameStereotypeAction, setStereotypeDefinitionAction } from "@/app/_actions/stereotype";
import { useAction } from "@/app/_components/use-action";
import { buttonClass, dangerClass, DraftLine, fieldKey, inputClass, smallButtonClass, TextArea, useDraft } from "@/app/_panels/fields";
import {
  STEREOTYPE_ADDED,
  STEREOTYPE_DEFINITION_CLEARED,
  STEREOTYPE_DEFINITION_SAVED,
  STEREOTYPE_REMOVED,
  STEREOTYPE_REMOVED_MOVED,
  STEREOTYPE_RENAMED,
} from "@/domain/commands/stereotype";
import {
  byStereotypeOrder,
  isBuiltinStereotype,
  proposedCode,
  STEREOTYPE_CODE_TAKEN,
  stereotypeCodeRefusal,
  STEREOTYPE_NAME_TAKEN,
  stereotypeNameTakenBy,
  typedStereotypeCode,
} from "@/domain/model/stereotypes";
import type { Stereotype } from "@/domain/types";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/ui/components/dialog";

export const STEREOTYPES_HINT =
  "What an entity is in the model. Names and definitions are the workspace's; codes never change, so entities, imports and exports keep them while names change. The five built-in ones stay (Object is a new entity's stereotype and every fact's and dimension's); own ones can be added and removed. Facts and dimensions show their InfoCube role instead.";
export const STEREOTYPE_ADD_HINT = "The code is proposed from the name; letters, digits and _, starting with a letter. It cannot change later.";
export const STEREOTYPE_MOVE_NOTE = "One undo step brings back the stereotype and every entity's.";

const entities = (n: number) => (n === 1 ? "1 entity" : `${n} entities`);
export const usedText = (n: number) => (n ? entities(n) : "unused");
export const removeQuestion = (n: number) =>
  n === 1 ? "1 entity has this stereotype. Choose the one it gets instead:" : `${n} entities have this stereotype. Choose the one they get instead:`;
export const removeButton = (n: number) => `Remove and move ${entities(n)}`;

export interface StereotypesBoxProps {
  workspaceId: string;
  editable: boolean;
  /** Every stereotype of the workspace, removed ones included (their codes stay taken). */
  stereotypes: readonly Stereotype[];
  /** Live logical entities per code. */
  uses: Readonly<Record<string, number>>;
}

const trimmed = (t: string) => t.trim();
const boxClass = "mt-3.5 rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]";
const hintClass = "m-0 mb-1.5 max-w-[90ch] text-[12.5px] text-im-ink-3";

export function StereotypesBox(p: StereotypesBoxProps) {
  const live = useMemo(() => p.stereotypes.filter((s) => s.deleted_at === null).sort(byStereotypeOrder), [p.stereotypes]);
  const { saveRow, pending } = useAction();
  const [removing, setRemoving] = useState<Stereotype | null>(null);

  const remove = async (s: Stereotype, moveTo?: string) => {
    const r = await saveRow(
      s,
      (v) => removeStereotypeAction(p.workspaceId, { stereotypeId: s.id, expectedVersion: v, ...(moveTo ? { moveTo } : {}) }),
      (x) => (x.moved && x.movedTo ? STEREOTYPE_REMOVED_MOVED(x.name, x.moved, x.movedTo) : STEREOTYPE_REMOVED(x.name)),
      { undoable: true, deletes: true },
    );
    if (r.ok) setRemoving(null);
  };
  /** Unused: at once, with Undo; used: the dialog first (item 6). */
  const askRemove = (s: Stereotype) => ((p.uses[s.code] ?? 0) ? setRemoving(s) : void remove(s));

  return (
    <section className={boxClass} data-testid="box-stereotypes">
      <h3 className="m-0 mb-1 text-[15px] font-semibold">Entity stereotypes</h3>
      <p className={hintClass}>{STEREOTYPES_HINT}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Name", "Code", "Definition", "Used", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap border-b border-im-line py-1 pr-2 text-left font-medium text-im-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {live.map((s) => (
              <Row key={s.id} s={s} {...p} onRemove={() => askRemove(s)} />
            ))}
          </tbody>
        </table>
      </div>
      {p.editable && <AddRow {...p} />}

      {removing && (
        <RemoveDialog
          s={removing}
          n={p.uses[removing.code] ?? 0}
          others={live.filter((x) => x.id !== removing.id)}
          pending={pending}
          onCancel={() => setRemoving(null)}
          onRemove={(moveTo) => void remove(removing, moveTo)}
        />
      )}
    </section>
  );
}

function Row({ s, onRemove, ...p }: StereotypesBoxProps & { s: Stereotype; onRemove: () => void }) {
  const { saveRow } = useAction();
  const [error, setError] = useState<string | null>(null);
  const own = !isBuiltinStereotype(s);
  // the name's draft (slice 13): kept across fresh pages and after a refusal, with the message under it; empty goes back
  const rename = async (n: string) => {
    if (stereotypeNameTakenBy(p.stereotypes, n, s.id)) {
      setError(STEREOTYPE_NAME_TAKEN);
      return null;
    }
    const r = await saveRow(s, (v) => renameStereotypeAction(p.workspaceId, { stereotypeId: s.id, expectedVersion: v, name: n }), (x) => STEREOTYPE_RENAMED(x.name), { undoable: true });
    setError(r.ok || r.code === "cut" ? null : r.message);
    return r;
  };
  const { bind, defaultValue, commit, keyDown, mark, takeStored, keepMine } = useDraft<HTMLInputElement>(s.name, rename, { prepare: trimmed, required: true, onEmpty: () => setError(null), version: s.version });
  return (
    <tr className="align-top" data-testid="stereotype-row" data-code={s.code}>
      <td className="border-b border-im-line py-1.5 pr-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.editable ? (
            <input
              key={fieldKey(s.id, "name")}
              ref={bind}
              type="text"
              defaultValue={defaultValue}
              aria-label="Name"
              aria-invalid={!!error}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                keyDown(e);
              }}
              className={`${inputClass} h-7 min-w-[140px] max-w-[240px]`}
              data-testid="input-stereotype-name"
            />
          ) : (
            <span data-testid="stereotype-name">{s.name}</span>
          )}
          {own && (
            <span className="whitespace-nowrap rounded-lg bg-im-logical-soft px-1.5 text-[10.5px] text-im-logical" data-testid="chip-own">
              own
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="stereotype-name-error">
            {error}
          </p>
        )}
        <DraftLine mark={mark} onUse={takeStored} onKeep={keepMine} />
      </td>
      <td className="whitespace-nowrap border-b border-im-line pb-1.5 pr-2 pt-[11px]" data-testid="stereotype-code">
        <span className="font-mono text-xs">{s.code}</span>
      </td>
      <td className="w-[48%] min-w-[220px] border-b border-im-line py-1.5 pr-2">
        <TextArea
          key={fieldKey(s.id, "definition")}
          version={s.version}
          value={s.definition ?? ""}
          rows={2}
          readOnly={!p.editable}
          placeholder={p.editable ? "What it means, when to use it" : undefined}
          aria-label="Definition"
          data-testid="input-stereotype-definition"
          prepare={trimmed}
          onSave={(text) =>
            saveRow(
              s,
              (v) => setStereotypeDefinitionAction(p.workspaceId, { stereotypeId: s.id, expectedVersion: v, definition: text.trim() ? text : null }),
              (x) => (x.removed ? STEREOTYPE_DEFINITION_CLEARED(x.name) : STEREOTYPE_DEFINITION_SAVED(x.name)),
              { undoable: true },
            )
          }
        />
      </td>
      <td className="whitespace-nowrap border-b border-im-line pb-1.5 pr-2 pt-[11px] text-im-ink-3" data-testid="stereotype-uses">
        {usedText(p.uses[s.code] ?? 0)}
      </td>
      <td className="border-b border-im-line py-1.5 text-right">
        {p.editable && own && (
          <button type="button" className={`${smallButtonClass} text-im-warn`} onClick={onRemove} data-testid="button-remove-stereotype">
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

/** Add an own stereotype: a name and its code, proposed from the name until the code is edited by hand (item 5, F6). */
function AddRow(p: StereotypesBoxProps) {
  const { run } = useAction();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const typed = typedStereotypeCode(code) ?? proposedCode(n);
    if (stereotypeNameTakenBy(p.stereotypes, n)) return setNameError(STEREOTYPE_NAME_TAKEN);
    const refusal = stereotypeCodeRefusal(p.stereotypes, typed);
    setCode(typed);
    if (refusal) return setCodeError(refusal);
    const r = await run(() => addStereotypeAction(p.workspaceId, { name: n, code: typed }), (v) => STEREOTYPE_ADDED(v.name, v.code), { undoable: true });
    if (r.ok) {
      setName("");
      setCode("");
      setTouched(false);
      setNameError(null);
      setCodeError(null);
    } else if (r.fields?.code || r.message === STEREOTYPE_CODE_TAKEN) setCodeError(r.fields?.code ?? r.message);
    else setNameError(r.message);
  };
  const enter = (e: React.KeyboardEvent) => e.key === "Enter" && void add();
  return (
    <div className="mt-2.5" data-testid="add-stereotype">
      <div className="grid grid-cols-[2fr_1fr_auto] gap-1.5 max-[640px]:grid-cols-1">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setCode(proposedCode(e.target.value));
            setNameError(null);
            setCodeError(null);
          }}
          onKeyDown={enter}
          placeholder="New stereotype, e.g. Event"
          aria-label="New stereotype"
          aria-invalid={!!nameError}
          className={inputClass}
          data-testid="input-new-stereotype"
        />
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setTouched(true);
            setCodeError(null);
          }}
          onKeyDown={enter}
          placeholder="Code, e.g. event"
          aria-label="Code"
          aria-invalid={!!codeError}
          className={`${inputClass} font-mono text-xs`}
          data-testid="input-new-stereotype-code"
        />
        <button type="button" className={smallButtonClass + " h-8"} onClick={() => void add()} data-testid="button-add-stereotype">
          Add
        </button>
      </div>
      {nameError && (
        <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="stereotype-new-name-error">
          {nameError}
        </p>
      )}
      {codeError && (
        <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="stereotype-code-error">
          {codeError}
        </p>
      )}
      <p className={`${hintClass} mt-1.5`}>{STEREOTYPE_ADD_HINT}</p>
    </div>
  );
}

/** A used own stereotype's removal (item 6): which stereotype its entities get, one undo step for both. */
function RemoveDialog({ s, n, others, pending, onCancel, onRemove }: { s: Stereotype; n: number; others: readonly Stereotype[]; pending: boolean; onCancel: () => void; onRemove: (moveTo: string) => void }) {
  const [to, setTo] = useState(others[0]?.id ?? "");
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-[480px]" data-testid="dialog-remove-stereotype">
        <DialogTitle className="text-base font-semibold">Remove {s.name}?</DialogTitle>
        <p className="mt-4" data-testid="remove-stereotype-question">
          {removeQuestion(n)}
        </p>
        <div className="mt-2.5 grid grid-cols-[auto_1fr] items-center gap-2">
          <label htmlFor="st-move-to" className="text-im-ink-2">
            Stereotype
          </label>
          <select id="st-move-to" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} data-testid="select-stereotype-move-to">
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[12px] text-im-ink-3">{STEREOTYPE_MOVE_NOTE}</p>
        <DialogFooter className="mt-4">
          <button type="button" className={buttonClass} onClick={onCancel} data-testid="button-cancel-remove-stereotype">
            Cancel
          </button>
          <button type="button" className={dangerClass} disabled={pending || !to} onClick={() => onRemove(to)} data-testid="button-confirm-remove-stereotype">
            {removeButton(n)}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
