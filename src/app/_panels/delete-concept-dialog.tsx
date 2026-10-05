"use client";

// Deleting a concept (D-47, prototype askDeleteConcept): an empty concept goes at once; a concept with entities only
// after its entities move to another concept; the only concept holding entities cannot be deleted.

import { useState } from "react";
import { deleteConceptAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import type { TreeConcept } from "./tree-data";

const entities = (n: number) => `${n} entit${n === 1 ? "y" : "ies"}`;
const button = "h-8 rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover";

export function DeleteConceptDialog({
  workspaceId,
  concept: c,
  others,
  onClose,
}: {
  workspaceId: string;
  concept: TreeConcept;
  others: TreeConcept[];
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const n = c.entities.length;
  const blocked = n > 0 && others.length === 0;

  async function confirm() {
    const target = others.find((o) => o.id === moveTo);
    const result = await run(
      () => deleteConceptAction(workspaceId, { conceptId: c.id, expectedVersion: c.version, moveToConceptId: n ? moveTo : null }),
      n ? `Moved the entities to ${target?.name ?? ""} and deleted ${c.name}.` : `Deleted the concept ${c.name}.`,
      { undoable: true },
    );
    if (result.ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-delete-concept">
        <div className="mb-1.5 text-[11.5px] text-im-ink-3">Concept</div>
        <DialogTitle className="text-base font-semibold">
          {blocked ? `${c.name} cannot be deleted yet` : `Delete the concept ${c.name}?`}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-[13px] text-im-ink-2">
            {blocked ? (
              <p>It is the only concept and holds {entities(n)}. Create another concept to move them to first.</p>
            ) : n === 0 ? (
              <p>It has no entities. You can undo it right after.</p>
            ) : (
              <>
                <p>
                  {c.name} holds <b>{entities(n)}</b>: {c.entities.map((e) => e.name).join(", ")}. Entities are not deleted with a
                  concept; move them first.
                </p>
                <label className="mt-2.5 block max-w-[320px]">
                  <span className="mb-1 block text-xs text-im-ink-2">Move them to</span>
                  <select
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    data-testid="select-move-to"
                    className="h-8 w-full rounded-md border border-im-line bg-im-surface px-2 text-im-ink"
                  >
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </DialogDescription>
        <DialogFooter className="mt-5">
          <button type="button" className={button} onClick={onClose}>
            {blocked ? "Close" : "Cancel"}
          </button>
          {!blocked && (
            <button
              type="button"
              className={`${button} text-im-warn`}
              disabled={pending}
              onClick={() => void confirm()}
              data-testid="button-confirm-delete-concept"
            >
              {n ? `Move ${n} and delete ${c.name}` : `Delete ${c.name}`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
