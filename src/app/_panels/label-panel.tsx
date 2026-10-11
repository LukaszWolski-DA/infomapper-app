"use client";

// The label panel (slice 3a, prototype insLabel): “Working label”, its name (renamed in place; the name stays unique in
// any case), what it marks (“Marks 2 entities, 3 attributes, 1 mapping.” or “Not used anywhere yet.”), the marked
// items by kind as links, and “Delete label”, which takes it off every item and leaves the model alone: no question, a
// toast with Undo, one undo step. The prototype's “Open as live canvas” comes with slice 3b.

import { useContext, useState } from "react";
import { deleteLabelAction, renameLabelAction } from "@/app/_actions/label";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { targetOf, type LabelTargetKind } from "@/domain/model/labels";
import type { Label } from "@/domain/types";
import { Actions, dangerClass, Field, Fold, Kind, Li, LongList, TextField, TypeDot } from "./fields";
import { usePanel } from "./inspector";
import { attributeLabel, inputsLabel, typeCheckOf } from "./model-index";

type Marked = { id: Uuid; name: string; meta: string; go: () => void; dot?: boolean };

/** “2 entities”, “1 attribute” … in the prototype's order: entities, attributes, tables, columns, mappings. */
const SENTENCE: [LabelTargetKind, string, string][] = [
  ["entity", "entity", "entities"],
  ["attribute", "attribute", "attributes"],
  ["source_table", "table", "tables"],
  ["source_column", "column", "columns"],
  ["mapping", "mapping", "mappings"],
];

export function LabelPanel({ label }: { label: Label }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run, pending } = useAction();
  /** A refused rename shows the stored name again. */
  const [reset, setReset] = useState(0);
  const ix = p.ix;

  const marked: Record<LabelTargetKind, Marked[]> = { entity: [], attribute: [], mapping: [], source_table: [], source_column: [] };
  for (const link of p.labelLinks) {
    if (link.label_id !== label.id) continue;
    const t = targetOf(link);
    if (!t) continue;
    if (t.kind === "entity" && ix.entity.has(t.id)) {
      const e = ix.entity.get(t.id)!;
      marked.entity.push({ id: t.id, name: e.name, meta: ix.model.concepts.find((c) => c.id === e.concept_id)?.name ?? "", go: () => p.goEntity(t.id) });
    } else if (t.kind === "attribute" && ix.attribute.has(t.id)) {
      const a = ix.attribute.get(t.id)!;
      marked.attribute.push({ id: t.id, name: a.name, meta: ix.entity.get(a.entity_id)?.name ?? "", go: () => p.goAttribute(t.id) });
    } else if (t.kind === "mapping" && ix.mapping.has(t.id)) {
      const m = ix.mapping.get(t.id)!;
      marked.mapping.push({ id: t.id, name: inputsLabel(ix, t.id), meta: `→ ${attributeLabel(ix, m.attribute_id)}`, go: () => p.goMapping(t.id), dot: typeCheckOf(ix, m).ok });
    } else if (t.kind === "source_table" && ix.table.has(t.id)) {
      const s = ix.table.get(t.id)!;
      marked.source_table.push({ id: t.id, name: s.name, meta: ix.model.sourceSystems.find((x) => x.id === s.source_system_id)?.name ?? "", go: () => p.goTable(t.id) });
    } else if (t.kind === "source_column" && ix.column.has(t.id)) {
      const c = ix.column.get(t.id)!;
      marked.source_column.push({ id: t.id, name: c.name, meta: ix.table.get(c.source_table_id)?.name ?? "", go: () => p.goColumn(t.id) });
    }
  }
  const parts = SENTENCE.filter(([k]) => marked[k].length).map(([k, one, many]) => `${marked[k].length} ${marked[k].length === 1 ? one : many}`);
  const mono = (k: LabelTargetKind) => k === "mapping" || k === "source_table" || k === "source_column";

  async function rename(name: string) {
    const r = await run(() => renameLabelAction(p.workspaceId, { labelId: label.id, expectedVersion: label.version, name }));
    if (!r.ok) setReset((n) => n + 1);
  }

  async function remove() {
    const r = await run(() => deleteLabelAction(p.workspaceId, { labelId: label.id, expectedVersion: label.version }), (v) => `Deleted the label ${v.name}.`, { undoable: true });
    if (r.ok) ui.select(null);
  }

  const section = (k: LabelTargetKind, title: string) =>
    marked[k].length > 0 && (
      <Fold title={title} count={marked[k].length} testId={`section-label-${k}`}>
        <LongList
          items={marked[k]}
          text={(m) => `${m.name} ${m.meta}`}
          testId="list-label-items"
          render={(m) => (
            <Li key={m.id} onClick={m.go} meta={m.meta} testId="item-label-marks">
              {m.dot === undefined ? (
                <span className={mono(k) ? "font-mono text-[12px]" : ""}>{m.name}</span>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <TypeDot ok={m.dot} />
                  <span className="truncate font-mono text-[12px]">{m.name}</span>
                </span>
              )}
            </Li>
          )}
        />
      </Fold>
    );

  return (
    <div data-testid="panel-label">
      <Kind>Working label</Kind>
      <Field label="Name" htmlFor="f-ln">
        <TextField key={`${label.id}:${label.version}:${reset}`} id="f-ln" value={label.name} required readOnly={!p.editable} onSave={(name) => void rename(name)} testId="input-label-name" />
      </Field>
      <p className="mt-3 text-im-ink-2" data-testid="text-label-marks">
        {parts.length ? `Marks ${parts.join(", ")}.` : "Not used anywhere yet."} Labels belong to your working context, not to the model.
      </p>
      {section("entity", "Entities")}
      {section("attribute", "Attributes")}
      {section("mapping", "Mappings")}
      {section("source_table", "Tables")}
      {section("source_column", "Columns")}
      {p.editable && (
        <>
          <Actions>
            <button type="button" className={dangerClass} disabled={pending} onClick={() => void remove()} data-testid="button-label-delete">
              Delete label
            </button>
          </Actions>
          <p className="mt-1.5 text-xs text-im-ink-3">Deleting takes the label off every item. The model is untouched.</p>
        </>
      )}
    </div>
  );
}
