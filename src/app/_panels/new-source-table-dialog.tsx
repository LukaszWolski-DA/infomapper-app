"use client";

// “New source table” (slice 1a, a simple manual entry until import, A-04): system, database, schema, name, and the
// columns typed as lines like `cust_id int` or `email varchar(255)`. An existing system is reused by name. The new
// table is placed on this canvas.

import { useContext, useState, type FormEvent } from "react";
import { createSourceTableAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { buttonClass, inputClass } from "./fields";

export function NewSourceTableDialog({ workspaceId, systems, onClose }: { workspaceId: string; systems: string[]; onClose: () => void }) {
  const ui = useContext(CanvasUiCtx);
  const { run, pending } = useAction();
  const [form, setForm] = useState({ systemName: systems[0] ?? "", databaseName: "", schemaName: "", name: "", columns: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      () => createSourceTableAction(workspaceId, form),
      (v) => `Created ${form.systemName} / ${form.databaseName}.${form.schemaName}.${form.name} with ${v.columns} column${v.columns === 1 ? "" : "s"}.`,
    );
    if (!result.ok) return;
    ui.place({ sourceTableId: result.value.sourceTableId }, result.value.columns, { quiet: true });
    onClose();
  }

  const field = (label: string, key: Exclude<keyof typeof form, "columns">, extra?: object) => (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-im-ink-3">{label}</span>
      <input value={form[key]} onChange={set(key)} required autoComplete="off" className={inputClass} data-testid={`input-new-table-${key}`} {...extra} />
    </label>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-new-source-table">
        <DialogTitle className="text-base font-semibold">New source table</DialogTitle>
        <DialogDescription className="mt-1 text-[12.5px] text-im-ink-2">
          Describe a table by hand. Import from a database comes later.
        </DialogDescription>
        <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-2.5">
          {field("System", "systemName", { list: "known-systems", placeholder: "e.g. CRM" })}
          <datalist id="known-systems">
            {systems.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-2.5">
            {field("Database", "databaseName", { placeholder: "e.g. crmprod" })}
            {field("Schema", "schemaName", { placeholder: "e.g. dbo" })}
          </div>
          {field("Table name", "name", { placeholder: "e.g. customers" })}
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-im-ink-3">Columns, one per line</span>
            <textarea
              value={form.columns}
              onChange={set("columns")}
              rows={6}
              placeholder={"cust_id int\nemail varchar(255)\namount decimal(18,2)"}
              className={`${inputClass} resize-y font-mono text-xs`}
              data-testid="input-new-table-columns"
            />
            <span className="mt-1 block text-[11.5px] text-im-ink-3">A name and a type; lines pasted from CREATE TABLE work too.</span>
          </label>
          <DialogFooter className="mt-2">
            <button type="button" className={buttonClass} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${buttonClass} border-im-map bg-im-map font-medium text-im-surface hover:bg-im-map`} disabled={pending} data-testid="button-create-table">
              Create table
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
