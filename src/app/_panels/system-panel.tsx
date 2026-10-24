"use client";

// The source system's panel (slice 7a, item 38; prototype insSystem without the changes to resolve, 7b): its counts,
// “Re-import {system}…” for those who may edit, and its imports, newest first. Opened from the Sources tab's open
// button, a table panel's system link, after an import, and by Back and Forward (a history place, item 39).

import { useState } from "react";
import type { SourceSystem } from "@/domain/types";
import { Fold, Hint, Kind, primaryClass } from "./fields";
import { ImportWizard } from "./import/import-wizard";
import { useImported } from "./import/use-imported";
import { plural } from "./import/wizard-model";
import { usePanel } from "./inspector";

export function SystemPanel({ system: s }: { system: SourceSystem }) {
  const p = usePanel();
  const imported = useImported();
  const [reimporting, setReimporting] = useState(false);
  const tables = p.ix.model.sourceTables.filter((t) => t.source_system_id === s.id);
  const columns = tables.flatMap((t) => p.ix.columnsOf.get(t.id) ?? []);
  const read = new Set(p.ix.model.mappingInputs.map((i) => i.source_column_id));
  const mapped = columns.filter((c) => read.has(c.id)).length;
  const missing = columns.filter((c) => c.missing_since).length;
  const imports = p.imports.filter((i) => i.systemId === s.id);

  return (
    <div data-testid="panel-source-system">
      <Kind>Source system</Kind>
      <h2 className="text-[15px] font-semibold leading-tight">{s.name}</h2>
      <p className="mt-1 text-im-ink-2" data-testid="system-counts">
        {plural(tables.length, "table")}, {plural(columns.length, "column")}, {mapped.toLocaleString("en-GB")} mapped
        {missing > 0 && (
          <>
            , <span className="rounded bg-im-warn-soft px-1.5 text-im-warn">{missing.toLocaleString("en-GB")} missing from source</span>
          </>
        )}
      </p>
      {p.editable && p.importData && (
        <div className="mb-1 mt-2.5">
          <button type="button" className={`${primaryClass} h-[26px] px-[9px] text-xs`} onClick={() => setReimporting(true)} data-testid="button-reimport">
            Re-import {s.name}…
          </button>
        </div>
      )}
      <Fold title="Imports" count={imports.length}>
        {imports.length ? (
          <ul data-testid="list-imports">
            {imports.map((i) => (
              <li key={i.id} className="border-b border-im-line py-[7px] text-[12.5px]" data-testid="import-entry">
                <b>{i.at}</b> · {i.label} · {i.by}
                <br />
                <span className="text-im-ink-3">{i.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Hint>No imports yet.</Hint>
        )}
      </Fold>
      {reimporting && p.importData && (
        <ImportWizard workspaceId={p.workspaceId} data={p.importData} systemId={s.id} onClose={() => setReimporting(false)} onImported={imported} />
      )}
    </div>
  );
}
