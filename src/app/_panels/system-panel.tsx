"use client";

// The source system's panel (slice 7a, item 38; prototype insSystem): its counts, “Re-import {system}…” for those who
// may edit, its changes to resolve with the resolved history (slice 7b, item 20), and its imports, newest first, each
// with “Show what it touched on the canvas” (the Changes view for it, item 26) and “Review the {n} sent back…” while
// mappings it sent back wait in review (item 17). Opened from the Sources tab's open
// button, a table panel's system link, after an import, and by Back and Forward (a history place, item 39).

import { useState } from "react";
import { changesImport } from "@/canvas/changes-import";
import { changesOn } from "@/canvas/changes-view";
import type { SourceSystem } from "@/domain/types";
import { Fold, Hint, Kind, primaryClass } from "./fields";
import { ImportWizard } from "./import/import-wizard";
import { useImported } from "./import/use-imported";
import { plural } from "./import/wizard-model";
import { usePanel } from "./inspector";
import { ApproveAgainAll, ChangesList } from "./source-changes";

export function SystemPanel({ system: s }: { system: SourceSystem }) {
  const p = usePanel();
  const imported = useImported();
  const [reimporting, setReimporting] = useState(false);
  const tables = p.ix.model.sourceTables.filter((t) => t.source_system_id === s.id);
  const columns = tables.flatMap((t) => p.ix.columnsOf.get(t.id) ?? []);
  const read = new Set(p.ix.model.mappingInputs.map((i) => i.source_column_id));
  const mapped = columns.filter((c) => read.has(c.id)).length;
  // retired columns are historical, not missing (slice 7b)
  const missing = columns.filter((c) => c.missing_since && !c.retired_since).length;
  const imports = p.imports.filter((i) => i.systemId === s.id);
  const changes = p.changes.filter((c) => c.source_system_id === s.id);
  const open = changes.filter((c) => c.deleted_at === null && c.status === "open").length;

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
      <Fold title={`Changes to resolve${open ? ` (${open})` : ""}`} testId="section-changes">
        <ChangesList changes={changes} history />
      </Fold>
      <Fold title="Imports" count={imports.length}>
        {imports.length ? (
          <ul data-testid="list-imports">
            {imports.map((i) => (
              <li key={i.id} className="border-b border-im-line py-[7px] text-[12.5px]" data-testid="import-entry">
                <b>{i.at}</b> · {i.label} · {i.by}
                <br />
                <span className="text-im-ink-3">{i.summary}</span>
                <br />
                {/* the Changes view for this import (slice 7b, item 26; F16: the panel shows only on canvas pages) */}
                <button
                  type="button"
                  className="text-xs text-im-logical hover:underline"
                  onClick={() => {
                    const v = changesImport(i.id, s.name, i.at, i.label);
                    changesOn.set({ sel: v.id, chip: v.chip });
                  }}
                  data-testid="button-show-touched"
                >
                  Show what it touched on the canvas
                </button>
                <ApproveAgainAll importId={i.id} />
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
