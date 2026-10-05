"use client";

// “Delete from model…” (D-47, prototype askDeleteEntity): the impact first, then the entity goes with its attributes,
// mappings, relationships and cards, in one change group.

import { useContext, useEffect, useRef, useState } from "react";
import { deleteEntityAction, entityImpactAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { EntityImpact } from "@/domain/model/impact";
import type { Entity } from "@/domain/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { buttonClass, dangerClass } from "./fields";
import { usePanel } from "./inspector";

const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

export function DeleteEntityDialog({ entity: e, onClose }: { entity: Entity; onClose: () => void }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { run, pending } = useAction();
  const [impact, setImpact] = useState<EntityImpact | null>(null);
  // Read once per entity; the parent may re-render with a new onClose meanwhile.
  const refusal = useRef({ toast, onClose });
  useEffect(() => {
    refusal.current = { toast, onClose };
  });

  useEffect(() => {
    let live = true;
    void entityImpactAction(p.workspaceId, e.id).then((r) => {
      if (!live) return;
      if (r.ok) setImpact(r.value);
      else {
        refusal.current.toast(r.message, "refusal");
        refusal.current.onClose();
      }
    });
    return () => {
      live = false;
    };
  }, [p.workspaceId, e.id]);

  async function confirm() {
    const result = await run(() => deleteEntityAction(p.workspaceId, { entityId: e.id, expectedVersion: e.version }), `Deleted ${e.name} from the model.`, { undoable: true });
    if (result.ok) {
      ui.select(null);
      onClose();
    }
  }

  const rows: [string, string][] = impact
    ? [
        [count(impact.attributes, "attribute"), "deleted"],
        [count(impact.mappings, "mapping"), impact.approvedMappings ? `deleted, ${impact.approvedMappings} of them approved` : "deleted"],
        [count(impact.relationships, "relationship"), "deleted"],
        [count(impact.canvases.length, "canvas", "canvases"), impact.canvases.length ? `removed from ${impact.canvases.map((c) => c.name).join(", ")}` : "–"],
        [count(impact.projects.length, "project"), impact.projects.length ? impact.projects.map((x) => x.name).join(", ") : "–"],
      ]
    : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-delete-entity">
        <div className="mb-1.5 text-[11.5px] text-im-ink-3">{p.ix.conceptName.get(e.concept_id) ?? ""} · entity</div>
        <DialogTitle className="text-base font-semibold">Delete {e.name} from the model?</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-[13px] text-im-ink-2">
            <p>
              This deletes the entity everywhere in this workspace, in every project and on every canvas. You can undo it right
              after.
            </p>
            {impact ? (
              <table className="mt-3 w-full border-collapse text-left" data-testid="table-entity-impact">
                <thead>
                  <tr className="border-b border-im-line text-[11.5px] text-im-ink-3">
                    <th className="py-1 font-normal">What</th>
                    <th className="py-1 font-normal">What happens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([what, happens]) => (
                    <tr key={what} className="border-b border-im-line">
                      <td className="py-1.5 pr-3 text-im-ink">{what}</td>
                      <td className="py-1.5">{happens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-im-ink-3">Counting what goes with it…</p>
            )}
            {impact && impact.projects.length > 1 && (
              <p className="mt-2.5 text-im-warn">
                It is used in {impact.projects.length} projects: {impact.projects.map((x) => x.name).join(", ")}.
              </p>
            )}
            <p className="mt-2.5 text-im-ink-3">To take it off only this canvas, use “Remove from this canvas” instead.</p>
          </div>
        </DialogDescription>
        <DialogFooter className="mt-5">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={dangerClass} disabled={!impact || pending} onClick={() => void confirm()} data-testid="button-confirm-delete-entity">
            Delete {e.name}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
