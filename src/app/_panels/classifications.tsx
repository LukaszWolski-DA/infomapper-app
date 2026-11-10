"use client";

// Classifications and notes in the source panels (slice 7c, items 7–15; prototype `togs`, `sourceBody`, `colSections`,
// `renderSettings`, the `[data-imx-note]` handler). A table's or column's section: one toggle per classification of its
// scope, in the groups General, Data Vault 2.0 (only in Data Vault 2.0 mode, P5) and This workspace, and "Edit the
// list…", which since slice 23 (item 8, D-78) opens the workspace home's Metadata conventions tab, where the list is
// edited (slice 7c's dialog moved there; its removal form is shared, `RemoveClassificationForm`). The note: plain text
// saved on blur, as a mapping's note (answer F7). Every write is one undo step; reviewers, readers and an archived
// workspace see it all read-only (item 12). Toggling is no place in the history (CLAUDE.md, back and forward).

import Link from "next/link";
import { useMemo } from "react";
import { setClassificationAction, setSourceNoteAction } from "@/app/_actions/classification";
import { useAction } from "@/app/_components/use-action";
import { CONVENTIONS_TAB, workspaceHref } from "@/app/_lib/paths";
import type { ClassificationImpact } from "@/domain/commands/classification";
import type { Uuid } from "@/domain/ids";
import { groupOf, isDataVault } from "@/domain/model/classifications";
import { dataVaultReading, READING_EMPTY, READING_FOOTER, readingText, type ReadingLine } from "@/domain/model/data-vault-reading";
import type { Classification, ClassificationScope, SourceTable } from "@/domain/types";
import { NOTE_REMOVED, NOTE_SAVED } from "@/domain/commands/source";
import { DialogFooter } from "@/ui/components/dialog";
import { buttonClass, dangerClass, Field, fieldKey, Fold, Hint, LongList, Li, TextArea } from "./fields";
import { usePanel } from "./inspector";

type Target = { kind: "source_table" | "source_column"; id: Uuid };
const GROUPS = ["General", "Data Vault 2.0", "This workspace"] as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The toggles of a table or column, with "Edit the list…" (items 13, 14). */
export function ClassificationsSection({ target }: { target: Target }) {
  const p = usePanel();
  const { run } = useAction();
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
          {/* a page of its own: Back returns to the canvas (slice 6b); a push, not a replace */}
          <Link href={workspaceHref(p.workspaceId, CONVENTIONS_TAB)} className="text-im-logical underline-offset-2 hover:underline" data-testid="button-edit-classifications">
            Edit the list…
          </Link>
        </Hint>
      </div>
    </Field>
  );
}

/** A table's or column's note (item 15, P8): plain text, saved on blur, with its toast and Undo. */
export function SourceNote({ target, name, version, value, placeholder, hint }: { target: Target; name: string; version: number; value: string | null; placeholder: string; hint?: string }) {
  const p = usePanel();
  const { saveRow } = useAction();
  const id = target.kind === "source_table" ? "f-table-note" : "f-column-note";
  return (
    <Field label="Note" htmlFor={id}>
      <TextArea
        key={fieldKey(target.id, "note")}
        id={id}
        value={value ?? ""}
        readOnly={!p.editable}
        placeholder={placeholder}
        data-testid="input-source-note"
        keep={{ key: fieldKey(target.id, "note"), field: "Note", object: name }}
        data-version={version}
        onSave={(note) =>
          saveRow({ id: target.id, version }, (v) => setSourceNoteAction(p.workspaceId, { target, expectedVersion: v, note: note.trim() ? note : null }), (x) => (x.removed ? NOTE_REMOVED(name) : NOTE_SAVED(name)), {
            undoable: true,
          })
        }
      />
      {hint && <Hint>{hint}</Hint>}
    </Field>
  );
}

/** A table's Data Vault reading (item 21, P10, AD-08; prototype `dvReading`): hints from its classifications and keys. */
export function DataVaultReading({ table }: { table: SourceTable }) {
  const p = usePanel();
  const lines = useMemo(
    () =>
      dataVaultReading(
        {
          table,
          columns: p.ix.columnsOf.get(table.id) ?? [],
          relationships: p.ix.relationshipsOf.get(table.id) ?? [],
          relationshipColumns: p.ix.model.sourceRelationshipColumns,
          tableName: (id) => p.ix.table.get(id)?.name ?? "?",
        },
        p.ix.classes,
      ),
    [table, p.ix],
  );
  return (
    <Fold title="Data Vault reading" testId="section-dv-reading">
      {lines.length ? (
        <>
          <ul>
            {lines.map((l) => (
              <li key={readingText(l)} className="border-b border-im-line py-1.5 text-[12.5px]" data-testid="dv-reading-line">
                <Reading line={l} />
              </li>
            ))}
          </ul>
          <Hint>{READING_FOOTER}</Hint>
        </>
      ) : (
        <Hint>{READING_EMPTY}</Hint>
      )}
    </Fold>
  );
}

/** Column and table names in a monospace font, as the prototype's `names`. */
function Names({ names }: { names: readonly string[] }) {
  return names.map((n, i) => (
    <span key={n}>
      {i > 0 && ", "}
      <span className="font-mono text-xs">{n}</span>
    </span>
  ));
}

/**
 * A reading line as the prototype draws it (AD-20; answers to step 5): the role in bold, names in monospace, the asides
 * muted. Its text is `readingText`'s, word for word.
 */
function Reading({ line: l }: { line: ReadingLine }) {
  const muted = "text-im-ink-3";
  switch (l.kind) {
    case "hub":
      return <><b className="font-semibold">Hub</b> on <Names names={l.columns} /></>;
    case "hub_candidate":
      return <><b className="font-semibold">Marked as a hub candidate</b>, but no column is a business key yet</>;
    case "link":
      return <><b className="font-semibold">Link</b> to <span className="font-mono text-xs">{l.to}</span> via <Names names={l.columns} />{!l.markedLinkKey && <> <span className={muted}>(foreign key; not marked Link key)</span></>}</>;
    case "link_key_without_relationship":
      return <><b className="font-semibold">Link key</b> <Names names={l.columns} /> <span className={muted}>with no relationship known: which table does it point to?</span></>;
    case "dependent_child_key":
      return <><b className="font-semibold">Dependent child key</b> <Names names={l.columns} />: part of the link’s or satellite’s key, not a hub</>;
    case "driving_key":
      return <><b className="font-semibold">Driving key</b> <Names names={l.columns} />: an effectivity satellite on the link tracks it</>;
    case "multi_active":
      return <><b className="font-semibold">Multi-active satellite</b> keyed by <Names names={l.columns} /></>;
    case "effective_dated":
      return <><b className="font-semibold">Effective-dated</b> by <Names names={l.columns} /></>;
    case "satellite":
      return <><b className="font-semibold">Satellite</b> with {l.descriptive} descriptive column{l.descriptive === 1 ? "" : "s"}{l.personalData.length > 0 && <>; {l.personalData.length} with personal data: consider a separate satellite for <Names names={l.personalData} /></>}</>;
  }
}

/**
 * Removing a classification in use (item 10, D-47): where it is used, what stops, what settles; Remove or Cancel. Since
 * slice 23 in the dialog of the workspace home's Metadata conventions tab (F7).
 */
export function RemoveClassificationForm({ classification: c, impact, pending, onCancel, onRemove }: { classification: Classification; impact: ClassificationImpact; pending: boolean; onCancel: () => void; onRemove: () => void }) {
  const uses = [...impact.tables.map((t) => ({ ...t, kind: "table" })), ...impact.columns.map((x) => ({ ...x, kind: "column" }))];
  return (
    <div className="mt-4" data-testid="form-remove-classification">
      <p className="font-medium" data-testid="remove-classification-uses">
        {uses.length ? `${c.name} is used on ${plural(impact.tables.length, "table")} and ${plural(impact.columns.length, "column")}.` : `${c.name} is unused.`}
      </p>
      {uses.length > 0 && (
        <div className="mt-2">
          <LongList items={uses} text={(x) => x.label} testId="list-classification-uses" render={(x) => <Li key={x.id} testId="classification-use"><span className="font-mono text-xs">{x.label}</span></Li>} />
        </div>
      )}
      {impact.stops && (
        <p className="mt-2.5 text-im-ink-2" data-testid="remove-classification-stops">
          {impact.stops}
        </p>
      )}
      {impact.settles > 0 && (
        <p className="mt-2 text-im-ink-2" data-testid="remove-classification-settles">
          {plural(impact.settles, "open business key change")} without a mapping will be settled.
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
