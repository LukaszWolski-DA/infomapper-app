"use client";

// Step 2 of the import wizard, Scope (slice 7a, PRD items 22–23; prototype `stepScope`, `massWarn`): the file's tables
// by database and schema, all selected at first; for an existing system what is missing is judged inside the imported
// schemas or only among the columns of the tables in the file (P4). A table that cannot be matched (names that differ
// only in case, step 3 answer 1) cannot be selected, and says why.

import { useEffect, useRef } from "react";
import type { ImportPlan } from "@/domain/import/plan";
import { tableKey, type StandardTable } from "@/domain/import/standard";
import type { WorkspaceModel } from "@/domain/types";
import { smallButtonClass } from "../fields";
import { plural, type WizardState } from "./wizard-model";

/** A checkbox that can be half on (`indeterminate` is a property, set after the commit, never read). */
function Check({ checked, mixed, disabled, onChange, testId, dataKey }: { checked: boolean; mixed?: boolean; disabled?: boolean; onChange: (on: boolean) => void; testId: string; dataKey: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!mixed;
  }, [mixed]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={testId} data-key={dataKey} />;
}

export function ScopeStep({
  s,
  set,
  model,
  plan,
  systemName,
}: {
  s: WizardState;
  set: (patch: Partial<WizardState>) => void;
  model: WorkspaceModel;
  plan: ImportPlan | null;
  systemName: string;
}) {
  const read = s.read!;
  const existing = s.mode === "existing";
  const leftOut = new Map(plan?.leftOut.map((l) => [l.key, l.reason]) ?? []);
  const known = new Set(
    existing ? model.sourceTables.filter((t) => t.source_system_id === s.systemId).map((t) => tableKey(t.database_name, t.schema_name, t.name)) : [],
  );
  const groups = new Map<string, StandardTable[]>();
  for (const t of read.tables) {
    const k = `${t.database}.${t.schema}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(s.scope);
    for (const k of keys) {
      if (leftOut.has(k)) continue;
      if (on) next.add(k);
      else next.delete(k);
    }
    set({ scope: next });
  };
  const willMiss = plan?.tables.filter((t) => t.status === "missing") ?? [];

  return (
    <div>
      <p className="mb-3 max-w-[72ch]">
        Choose what this import covers. Tables and columns that are not in the file are marked “missing from source” only inside the schemas you import, so a partial file never
        touches the rest of {systemName}.
      </p>
      <ul className="rounded-lg border border-im-line">
        {[...groups].map(([k, tables]) => {
          const selectable = tables.filter((t) => !leftOut.has(t.key));
          const all = selectable.length > 0 && selectable.every((t) => s.scope.has(t.key));
          const some = selectable.some((t) => s.scope.has(t.key));
          const fresh = tables.filter((t) => !known.has(t.key)).length;
          return (
            <li key={k} className="border-b border-im-line px-3 py-2 last:border-b-0" data-testid="scope-group" data-key={k}>
              <label className="flex items-center gap-2">
                <Check checked={all} mixed={!all && some} disabled={!selectable.length} onChange={(on) => toggle(tables.map((t) => t.key), on)} testId="checkbox-scope-group" dataKey={k} />
                <b className="font-mono">{k}</b>
                <span className="text-im-ink-3">
                  {plural(tables.length, "table")}
                  {existing ? (fresh === tables.length ? `, all new to ${systemName}` : fresh ? `, ${fresh} new` : "") : ""}
                </span>
              </label>
              <ul className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-3 gap-y-0.5 pl-[26px]">
                {tables.map((t) => {
                  const reason = leftOut.get(t.key);
                  return (
                    <li key={t.key} className={reason ? "col-span-full" : undefined}>
                      <label className="flex items-center gap-2" title={reason}>
                        <Check checked={!reason && s.scope.has(t.key)} disabled={!!reason} onChange={(on) => toggle([t.key], on)} testId="checkbox-scope-table" dataKey={t.key} />
                        <span className={`min-w-0 truncate font-mono ${reason ? "text-im-ink-3" : ""}`} title={t.name}>
                          {t.name}
                        </span>
                        <span className="text-im-ink-3">{t.columns.length}</span>
                      </label>
                      {reason && (
                        <p className="ml-6 text-xs text-im-warn" data-testid="scope-left-out">
                          {reason}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      {existing && (
        <fieldset className="mt-4">
          <legend className="mb-2 font-semibold">What is missing from the source?</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["schemas", "Anything in the imported schemas that is not in the file", "For a full snapshot of a schema"],
                ["tables", "Only columns of the tables in the file", "For a file with a few tables"],
              ] as const
            ).map(([v, title, small]) => (
              <label key={v} className={`flex min-w-[170px] cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${s.compare === v ? "border-im-logical bg-im-logical-soft" : "border-im-line"}`}>
                <input type="radio" name="import-compare" className="mt-1" checked={s.compare === v} onChange={() => set({ compare: v })} data-testid={`radio-compare-${v}`} />
                <span>
                  {title}
                  <small className="block text-im-ink-3">{small}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {plan?.massWarning && (
        <div className="my-3 rounded-r-md border-l-[3px] border-im-warn bg-im-warn-soft px-3 py-2" data-testid="callout-mass">
          <b>
            This import would mark {plan.massWarning.missing.toLocaleString("en-GB")} of {plan.massWarning.present.toLocaleString("en-GB")} columns of {systemName} missing from source.
          </b>{" "}
          If the file holds only part of the system, compare only the tables in the file.
          {s.compare === "schemas" && (
            <p className="mt-2">
              <button type="button" className={smallButtonClass} onClick={() => set({ compare: "tables" })} data-testid="button-narrow">
                Compare only the tables in the file
              </button>
            </p>
          )}
        </div>
      )}
      {willMiss.length ? (
        <div className="my-3 rounded-r-md border-l-[3px] border-im-warn bg-im-warn-soft px-3 py-2" data-testid="callout-missing">
          <b>Not in the file:</b>{" "}
          {willMiss.map((t, i) => (
            <span key={t.key}>
              {i > 0 && ", "}
              <span className="font-mono">
                {t.existing!.schema_name}.{t.existing!.name}
              </span>
            </span>
          ))}
          . {willMiss.length === 1 ? "It" : "They"} will be marked missing from source, with {willMiss.length === 1 ? "its" : "their"} mappings kept.
        </div>
      ) : existing && s.compare === "schemas" ? (
        <div className="my-3 rounded-r-md border-l-[3px] border-im-logical bg-im-logical-soft px-3 py-2" data-testid="callout-missing">
          Every table {systemName} has in the selected schemas is in the file.
        </div>
      ) : null}
    </div>
  );
}
