"use client";

// The workspace home's "Metadata conventions" tab (slice 23, items 1–15, D-78; prototype `CONV.tab`): the one place to
// edit the classification list (slice 7c's dialog moved here), the concepts' colours (moved from Settings) and the
// naming conventions; since slice 24 the entity stereotypes (`stereotypes-box.tsx`). Every member sees it; owners, admins and modelers in a workspace that is not archived edit it
// (D-57's roles); everyone else sees it read only.
//   Classifications: two tables, for source columns and for source tables, each row with its name (saved on leaving it,
// D-66's draft, refused when taken: the message under the field), its code (built-in, own or "—"), its definition (plain
// text, saved on leaving it), its uses and Remove; the removed built-in ones under their table with Restore; an Add row
// with a name and an optional code. Each change is one undo step. Removing one that is used or that a rule reads opens a
// small dialog with D-57's form (where it is used, what stops, what settles), read when it opens
// (`classificationImpactAction`); any other is removed at once, with Undo.
//   Naming conventions: plain text, a workspace setting outside undo (F11), on the workspace row's save chain (D-59).
// The page sends plain rows only (acceptance F7): every classification of the workspace, removed ones too (the name and
// code checks need their codes), with its use count. Nothing here reads layout.

import { useMemo, useState } from "react";
import {
  addClassificationAction,
  classificationImpactAction,
  removeClassificationAction,
  renameClassificationAction,
  restoreClassificationAction,
  setClassificationDefinitionAction,
} from "@/app/_actions/classification";
import { setNamingConventionsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { DraftLine, fieldKey, inputClass, smallButtonClass, TextArea, useDraft } from "@/app/_panels/fields";
import { RemoveClassificationForm } from "@/app/_panels/classifications";
import { DEFINITION_CLEARED, DEFINITION_SAVED, type ClassificationImpact } from "@/domain/commands/classification";
import { NAMING_CLEARED, NAMING_SAVED } from "@/domain/commands/workspace";
import { byListOrder, codeRefusal, isBuiltin, isDataVault, nameTakenBy, TAKEN_CODE, TAKEN_NAME, typedCode, whatStops } from "@/domain/model/classifications";
import type { Classification, ClassificationScope, Stereotype } from "@/domain/types";
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/dialog";
import { ConceptColours, type ConceptColorRow } from "./settings-form";
import { StereotypesBox } from "./stereotypes-box";

export const CONVENTIONS_INTRO =
  "The workspace's conventions, in one place. The import matches classifications by their name or code; table and column panels set them; entity panels offer the stereotypes; documents and exports print their definitions.";
export const CLASSIFICATIONS_HINT =
  "One list for the workspace's source tables and columns. Every name can be changed; built-in ones keep a code the app's rules read (BK, PII, LK…), so a renamed one keeps working and a removed one is absent until it is restored. An own classification may get a code when it is added, for import files that should not depend on its name; the code cannot change later. A new workspace starts with the built-in names and definitions in its documentation language; changing the language later renames nothing.";
export const NAMING_HINT = "Your rules for names of entities, attributes, keys and codes, as plain text. Documents print them in their conventions section; nothing checks names against them yet.";
export const NAMING_PLACEHOLDER = "- Entities: singular, Title Case (Sales Order)\n- Attributes: snake_case (order_date)\n- Keys: …_id; surrogate keys: …_key";
export const CONVENTIONS_LATER = "Later, in their own slices: the map from physical to logical types, an organization's default conventions.";
export const NO_CODE_TITLE = "No code: an import file names it by its name";

export interface ConventionsProps {
  workspaceId: string;
  workspaceVersion: number;
  editable: boolean;
  dataVault: boolean;
  /** Every classification of the workspace, removed ones included. */
  classifications: readonly Classification[];
  /** Live uses (links on tables and columns) per classification id. */
  uses: Readonly<Record<string, number>>;
  concepts: readonly ConceptColorRow[];
  namingConventions: string | null;
  /** Slice 24: every stereotype of the workspace, removed ones included, and the live logical entities per code. */
  stereotypes: readonly Stereotype[];
  stereotypeUses: Readonly<Record<string, number>>;
}

const trimmed = (t: string) => t.trim();
const boxClass = "mt-3.5 rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]";
const hintClass = "m-0 mb-1.5 max-w-[90ch] text-[12.5px] text-im-ink-3";

export function Conventions(p: ConventionsProps) {
  const { saveRow, run, pending } = useAction();
  const [removing, setRemoving] = useState<{ c: Classification; impact: ClassificationImpact | null } | null>(null);

  const remove = async (c: Classification) => {
    // on the classification's save chain, with its rename and its definition (slice 10a)
    const r = await saveRow(c, (v) => removeClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: v }), (v) => `Removed ${v.name} from the list.`, { undoable: true, deletes: true });
    if (r.ok) setRemoving(null);
  };
  /** The form first when it is in use or a rule reads it (7c, Łukasz, step 4); otherwise at once, with Undo. */
  const askRemove = async (c: Classification) => {
    if (!(p.uses[c.id] ?? 0) && !whatStops(c)) return void remove(c);
    setRemoving({ c, impact: null });
    const r = await run(() => classificationImpactAction(p.workspaceId, c.id));
    if (r.ok) setRemoving((now) => (now?.c.id === c.id ? { c, impact: r.value } : now));
    else setRemoving(null);
  };

  return (
    <div data-testid="page-conventions">
      <p className="mb-1 mt-3.5 max-w-[80ch] text-im-ink-2" data-testid="text-conventions-intro">
        {CONVENTIONS_INTRO}
      </p>

      <section className={boxClass} data-testid="box-classifications">
        <h3 className="m-0 mb-1 text-[15px] font-semibold">Classifications</h3>
        <p className={hintClass}>{CLASSIFICATIONS_HINT}</p>
        {(["column", "table"] as const).map((scope) => (
          <ScopeTable key={scope} scope={scope} {...p} onRemove={(c) => void askRemove(c)} />
        ))}
      </section>

      {/* slice 24 (item 1): between Classifications and Concept colours */}
      <StereotypesBox workspaceId={p.workspaceId} editable={p.editable} stereotypes={p.stereotypes} uses={p.stereotypeUses} />

      <ConceptColours workspaceId={p.workspaceId} concepts={p.concepts} editable={p.editable} />

      <section className={boxClass} data-testid="box-naming-conventions">
        <h3 className="m-0 mb-1 text-[15px] font-semibold">Naming conventions</h3>
        <p className={hintClass}>{NAMING_HINT}</p>
        <TextArea
          key={fieldKey(p.workspaceId, "naming_conventions")}
          value={p.namingConventions ?? ""}
          rows={7}
          readOnly={!p.editable}
          placeholder={NAMING_PLACEHOLDER}
          aria-label="Naming conventions"
          data-testid="input-naming-conventions"
          prepare={trimmed}
          onSave={(text) =>
            saveRow(
              { id: p.workspaceId, version: p.workspaceVersion },
              (v) => setNamingConventionsAction({ workspaceId: p.workspaceId, expectedVersion: v, namingConventions: text.trim() ? text : null }),
              (x) => (x.removed ? NAMING_CLEARED : NAMING_SAVED),
            )
          }
        />
      </section>

      <p className="mt-3.5 max-w-[90ch] text-[12.5px] italic text-im-ink-3" data-testid="text-conventions-later">
        {CONVENTIONS_LATER}
      </p>

      {removing && (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-[520px]" data-testid="dialog-remove-classification">
            <DialogTitle className="text-base font-semibold">Remove {removing.c.name}?</DialogTitle>
            {removing.impact ? (
              <RemoveClassificationForm classification={removing.c} impact={removing.impact} pending={pending} onCancel={() => setRemoving(null)} onRemove={() => void remove(removing.c)} />
            ) : (
              <p className="mt-4 text-im-ink-3">Reading where it is used…</p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** "For source columns" or "For source tables": the rows, the removed built-in ones, the Add row. */
function ScopeTable({ scope, onRemove, ...p }: ConventionsProps & { scope: ClassificationScope; onRemove: (c: Classification) => void }) {
  const live = useMemo(() => p.classifications.filter((c) => c.scope === scope && c.deleted_at === null).sort(byListOrder), [p.classifications, scope]);
  const removed = useMemo(() => p.classifications.filter((c) => c.scope === scope && c.deleted_at !== null && isBuiltin(c)).sort(byListOrder), [p.classifications, scope]);
  const { saveRow } = useAction();
  const restore = (c: Classification) =>
    void saveRow(c, (v) => restoreClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: v }), (v) => `Restored ${v.name}.`, { undoable: true });

  return (
    <div data-testid={`section-${scope}-classifications`}>
      <h4 className="mb-1.5 mt-3.5 text-[13px] font-semibold text-im-ink-2">{scope === "column" ? "For source columns" : "For source tables"}</h4>
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
            {live.map((c) => (
              <Row key={c.id} c={c} {...p} onRemove={() => onRemove(c)} />
            ))}
          </tbody>
        </table>
      </div>
      {removed.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-im-ink-3" data-testid="section-removed-classifications">
          Removed built-in:
          {removed.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5" data-testid="removed-classification">
              {c.name} <span className="font-mono text-xs">{c.code}</span>
              {p.editable && (
                <button type="button" className={smallButtonClass} onClick={() => restore(c)} data-testid="button-restore-classification">
                  Restore
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {p.editable && <AddRow scope={scope} {...p} />}
    </div>
  );
}

const DIMMED = "[&>td]:opacity-60";

function Row({ c, onRemove, ...p }: ConventionsProps & { c: Classification; onRemove: () => void }) {
  const { saveRow } = useAction();
  const [error, setError] = useState<string | null>(null);
  const uses = p.uses[c.id] ?? 0;
  const dv = isDataVault(c);
  // the name's draft (slice 13): kept across fresh pages and after a refusal, with the message under it; empty goes back
  const rename = async (n: string) => {
    if (nameTakenBy(p.classifications, c.scope, n, c.id)) {
      setError(TAKEN_NAME);
      return null;
    }
    const r = await saveRow(c, (v) => renameClassificationAction(p.workspaceId, { classificationId: c.id, expectedVersion: v, name: n }));
    setError(r.ok || r.code === "cut" ? null : r.message);
    return r;
  };
  const { bind, defaultValue, commit, keyDown, mark, takeStored, keepMine } = useDraft<HTMLInputElement>(c.name, rename, { prepare: (t) => t.trim(), required: true, onEmpty: () => setError(null) });
  return (
    <tr className={`align-top ${dv && !p.dataVault ? DIMMED : ""}`} data-testid="classification-row" data-code={c.code ?? ""} data-dimmed={dv && !p.dataVault ? "true" : undefined}>
      <td className="border-b border-im-line py-1.5 pr-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.editable ? (
            <input
              key={fieldKey(c.id, "name")}
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
              data-testid="input-classification-name"
            />
          ) : (
            <span data-testid="classification-name">{c.name}</span>
          )}
          {dv && (
            <span className="whitespace-nowrap rounded-lg bg-im-hover px-1.5 text-[10.5px] text-im-ink-2" data-testid="chip-data-vault">
              Data Vault 2.0{p.dataVault ? "" : " · hidden while the mode is off"}
            </span>
          )}
          {!isBuiltin(c) && (
            <span className="whitespace-nowrap rounded-lg bg-im-logical-soft px-1.5 text-[10.5px] text-im-logical" data-testid="chip-own">
              own
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="classification-name-error">
            {error}
          </p>
        )}
        <DraftLine mark={mark} onUse={takeStored} onKeep={keepMine} />
      </td>
      <td className="whitespace-nowrap border-b border-im-line pb-1.5 pr-2 pt-[11px]" data-testid="classification-code">
        {c.code !== null ? (
          <span className="font-mono text-xs">{c.code}</span>
        ) : (
          <span className="text-im-ink-3" title={NO_CODE_TITLE}>
            —
          </span>
        )}
      </td>
      <td className="w-[48%] min-w-[220px] border-b border-im-line py-1.5 pr-2">
        <TextArea
          key={fieldKey(c.id, "definition")}
          value={c.definition ?? ""}
          rows={2}
          readOnly={!p.editable}
          placeholder={p.editable ? "What it means, when to use it" : undefined}
          aria-label="Definition"
          data-testid="input-classification-definition"
          prepare={trimmed}
          onSave={(text) =>
            saveRow(
              c,
              (v) => setClassificationDefinitionAction(p.workspaceId, { classificationId: c.id, expectedVersion: v, definition: text.trim() ? text : null }),
              (x) => (x.removed ? DEFINITION_CLEARED(x.name) : DEFINITION_SAVED(x.name)),
              { undoable: true },
            )
          }
        />
      </td>
      <td className="whitespace-nowrap border-b border-im-line pb-1.5 pr-2 pt-[11px] text-im-ink-3" data-testid="classification-uses">
        {uses ? `used ${uses}×` : "unused"}
      </td>
      <td className="border-b border-im-line py-1.5 text-right">
        {p.editable && (
          <button type="button" className={`${smallButtonClass} text-im-warn`} onClick={onRemove} data-testid="button-remove-classification">
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

/** Add an own classification: a name and an optional code (items 6, D-78); Enter in either field adds. */
function AddRow({ scope, ...p }: ConventionsProps & { scope: ClassificationScope }) {
  const { run } = useAction();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const typed = typedCode(code);
    if (nameTakenBy(p.classifications, scope, n)) return setNameError(TAKEN_NAME);
    const refusal = typed ? codeRefusal(p.classifications, scope, typed) : null;
    if (refusal) return setCodeError(refusal);
    const r = await run(() => addClassificationAction(p.workspaceId, { scope, name: n, ...(typed ? { code: typed } : {}) }));
    if (r.ok) {
      setName("");
      setCode("");
      setNameError(null);
      setCodeError(null);
    } else if (r.fields?.code || r.message === TAKEN_CODE) setCodeError(r.fields?.code ?? r.message);
    else setNameError(r.message);
  };
  const enter = (e: React.KeyboardEvent) => e.key === "Enter" && void add();
  return (
    <div className="mt-2.5">
      <div className="grid grid-cols-[2fr_1fr_auto] gap-1.5 max-[640px]:grid-cols-1">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          onKeyDown={enter}
          placeholder={scope === "column" ? "New column classification, e.g. Hash candidate" : "New table classification, e.g. Golden source"}
          aria-label={scope === "column" ? "New column classification" : "New table classification"}
          aria-invalid={!!nameError}
          className={inputClass}
          data-testid={`input-new-${scope}-classification`}
        />
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeError(null);
          }}
          onKeyDown={enter}
          placeholder={scope === "column" ? "Code (optional), e.g. HASH" : "Code (optional), e.g. GOLD"}
          aria-label="Code"
          aria-invalid={!!codeError}
          className={`${inputClass} font-mono text-xs`}
          data-testid={`input-new-${scope}-code`}
        />
        <button type="button" className={smallButtonClass + " h-8"} onClick={() => void add()} data-testid={`button-add-${scope}-classification`}>
          Add
        </button>
      </div>
      {nameError && (
        <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="classification-name-error">
          {nameError}
        </p>
      )}
      {codeError && (
        <p role="alert" className="mt-1 text-[12px] text-im-warn" data-testid="classification-code-error">
          {codeError}
        </p>
      )}
    </div>
  );
}
