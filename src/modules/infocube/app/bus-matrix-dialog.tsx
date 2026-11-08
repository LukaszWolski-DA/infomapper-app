"use client";

// The bus matrix (slice 15d, B-8 with R-8 and RP-10; prototype `openBusMatrix`): the Cube tab's "Bus matrix" opens it for
// every role who can open the workspace. Its rows are read when it opens (`busMatrixAction`, Y5): a snapshot of that
// moment. Facts with their grain in rows, dimensions with their SCD type in columns, one dot per relationship (filled
// when a key carries it), the facts per dimension in the footer. A name opens its entity and a dot its relationship, by
// the app's go-to rule (D13); the dialog closes. The table scrolls inside the dialog and reads no layout (CLAUDE.md).

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import type { TabDialogProps } from "@/ui/modules";
import { BUS_MATRIX_TEXTS as T, type BusMatrix } from "../domain/bus-matrix";
import { CubeIcon } from "../ui/cube-icon";
import { busMatrixAction } from "./actions";

const nameButton = "max-w-[160px] truncate rounded px-1 text-left font-medium text-im-ink hover:bg-im-hover hover:underline";

export function BusMatrixDialog({ workspaceId, openEntity, openRelationship, onClose }: TabDialogProps) {
  const toast = useToast();
  const [matrix, setMatrix] = useState<BusMatrix | null>(null);

  useEffect(() => {
    let live = true;
    void busMatrixAction(workspaceId).then((r) => {
      if (!live) return;
      if (!r.ok) {
        toast(r.message);
        onClose();
      } else if (!r.value.facts.length && !r.value.dimensions.length) {
        toast(T.empty);
        onClose();
      } else setMatrix(r.value);
    });
    return () => {
      live = false;
    };
  }, [workspaceId, toast, onClose]);

  if (!matrix) return null;
  const go = (open: () => void) => {
    onClose();
    open();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(960px,calc(100vw-32px))] gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-bus-matrix">
        <div className="mb-1.5 flex items-center gap-1 text-[11.5px] text-im-ink-3">
          {matrix.workspace} · <CubeIcon /> InfoCube
        </div>
        <DialogTitle className="text-base font-semibold">{T.title}</DialogTitle>
        <DialogDescription className="mt-2 text-[13px] text-im-ink-2">{T.intro}</DialogDescription>
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-im-line" data-testid="bus-matrix">
          <table className="border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 border-b border-r border-im-line bg-im-surface px-2 py-1.5 text-left font-semibold">
                  {T.fact} <small className="block font-normal text-im-ink-3">{T.grain}</small>
                </th>
                {matrix.dimensions.map((d) => (
                  <th key={d.id} className="sticky top-0 z-10 border-b border-im-line bg-im-surface px-2 py-1.5 text-center font-normal" data-testid="bus-dimension" data-entity-id={d.id}>
                    <button type="button" className={nameButton} onClick={() => go(() => openEntity(d.id))} data-testid="bus-open-entity">
                      {d.name}
                    </button>
                    <small className="block text-im-ink-3">{d.history}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.facts.map((f) => (
                <tr key={f.id} data-testid="bus-fact" data-entity-id={f.id}>
                  <th className="sticky left-0 z-10 border-r border-im-line bg-im-surface px-2 py-1.5 text-left font-normal">
                    <button type="button" className={nameButton} onClick={() => go(() => openEntity(f.id))} data-testid="bus-open-entity">
                      {f.name}
                    </button>
                    <small className={`block ${f.grain ? "text-im-ink-3" : "text-im-warn"}`}>{f.grain ?? T.noGrain}</small>
                  </th>
                  {matrix.dimensions.map((d) => (
                    <td key={d.id} className="px-2 py-1.5 text-center" data-testid="bus-cell" data-dimension-id={d.id}>
                      {(matrix.cells[f.id]?.[d.id] ?? []).map((dot) => (
                        <button
                          key={dot.relationshipId}
                          type="button"
                          className={`mx-0.5 rounded px-0.5 text-[15px] leading-none hover:bg-im-hover ${dot.key ? "text-im-logical" : "text-im-warn"}`}
                          title={dot.title}
                          onClick={() => go(() => openRelationship(dot.relationshipId))}
                          data-testid="bus-dot"
                          data-relationship-id={dot.relationshipId}
                          data-key={dot.key ?? ""}
                        >
                          {dot.key ? "●" : "○"}
                        </button>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 border-r border-t border-im-line bg-im-surface px-2 py-1.5 text-left text-im-ink-2">{T.usedBy}</td>
                {matrix.dimensions.map((d) => (
                  <td key={d.id} className="border-t border-im-line px-2 py-1.5 text-center text-im-ink-2" data-testid="bus-used-by" data-dimension-id={d.id}>
                    {d.facts ? (
                      <>
                        {T.facts(d.facts)}
                        {d.facts > 1 && <span className="block font-medium text-im-logical">{T.conformed}</span>}
                      </>
                    ) : (
                      <span className="text-im-warn">{T.unused}</span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-im-ink-3">{T.legend}</p>
        <DialogFooter className="mt-4">
          <button type="button" className="rounded-md border border-im-line px-3 py-1.5 hover:bg-im-hover" onClick={onClose} data-testid="button-bus-close">
            {T.close}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
