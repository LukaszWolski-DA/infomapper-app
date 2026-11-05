"use client";

// "Create dimension from this…" (slice 15c, B-2, C9; prototype `askDimFrom`): a logical card's header menu opens it.
// Its name is "Dim {entity}", numbered when that name is taken among the facts and dimensions ("Dim Product 2"); a typed
// name that is taken gets InfoMapper's duplicate-name warning under the field, as it does after the create (Łukasz, 15c
// step 3). Every attribute is ticked; the command writes the dimension, its key, the copies, their Draft mappings and
// its card to the right of the original's in one undo step. The new card is selected and centred (the prototype).

import { useContext, useMemo, useState } from "react";
import { useAction } from "@/app/_components/use-action";
import { buttonClass, Field, inputClass, Note, primaryClass } from "@/app/_panels/fields";
import { usePanel } from "@/app/_panels/inspector";
import { CanvasUiCtx } from "@/canvas/context";
import { newCardHeight } from "@/canvas/geometry";
import { duplicateNameWarning } from "@/domain/commands/entity";
import type { Uuid } from "@/domain/ids";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { CubeIcon } from "../ui/cube-icon";
import { typeWord } from "../domain/keys";
import { proposedDimensionName } from "../domain/mappings";
import { createDimensionFromAction } from "./actions";

export function CreateDimensionDialog({ entityId, onClose }: { entityId: Uuid; onClose: () => void }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { run, pending } = useAction();
  const ix = p.ix;
  const e = ix.entity.get(entityId);
  const attributes = useMemo(() => ix.attributesOf.get(entityId) ?? [], [ix, entityId]);
  const dimensional = useMemo(
    () => new Set(ix.model.entities.filter((x) => x.deleted_at === null && x.model_level === "dimensional").map((x) => x.name.toLocaleLowerCase())),
    [ix.model.entities],
  );
  const taken = (name: string) => dimensional.has(name.trim().toLocaleLowerCase());
  const [name, setName] = useState(() => proposedDimensionName(e?.name ?? "", taken));
  const [ticked, setTicked] = useState<ReadonlySet<Uuid>>(() => new Set(attributes.map((a) => a.id)));
  if (!e) return null;
  const typed = name.trim();
  const duplicate = typed !== "" && taken(typed);

  async function create() {
    const original = p.cardOf(entityId);
    // with the original's card here, the new card goes to its right and joins the frame it lands in (slice 2b)
    const placement = original ? { canvasId: p.canvasId, height: newCardHeight(ticked.size + 1), frames: ui.frameRefs() } : undefined;
    const result = await run(
      () => createDimensionFromAction(p.workspaceId, { entityId, ...(typed ? { name: typed } : {}), attributeIds: attributes.filter((a) => ticked.has(a.id)).map((a) => a.id), ...(placement ? { placement } : {}) }),
      (v) => v.toast,
      { undoable: true },
    );
    if (!result.ok) return;
    onClose();
    if (result.value.warning) toast(result.value.warning);
    const cardId = result.value.canvasItemId;
    if (cardId) {
      ui.select({ t: "card", id: cardId });
      ui.centerOn(cardId);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-create-dimension">
        <div className="mb-1.5 flex items-center gap-1 text-[11.5px] text-im-ink-3">
          {ix.conceptName.get(e.concept_id) ?? ""} · <CubeIcon /> InfoCube
        </div>
        <DialogTitle className="text-base font-semibold">Create a dimension from {e.name}</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-[13px] text-im-ink-2">
            <p>
              The dimension gets a surrogate key and a copy of each ticked attribute, mapped from the original (direct, Draft). Nothing changes in {e.name}.
            </p>
          </div>
        </DialogDescription>
        <div className="mt-3">
          <Field label="Name" htmlFor="dm-name">
            <input id="dm-name" value={name} onChange={(ev) => setName(ev.target.value)} className={inputClass} data-testid="input-dimension-name" />
          </Field>
          {duplicate && <Note warn testId="note-dimension-duplicate">{duplicateNameWarning(typed)}</Note>}
          <div className="mt-2 max-h-[40vh] overflow-auto" data-testid="list-dimension-attributes">
            {attributes.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-im-hover" data-testid="dimension-attribute">
                <input
                  type="checkbox"
                  checked={ticked.has(a.id)}
                  data-attribute={a.id}
                  onChange={(ev) => {
                    const next = new Set(ticked);
                    if (ev.target.checked) next.add(a.id);
                    else next.delete(a.id);
                    setTicked(next);
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">
                  {typeWord(a)}
                  {a.is_primary_key ? " · PK" : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="mt-5">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryClass} disabled={pending} onClick={() => void create()} data-testid="button-create-dimension">
            Create dimension
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
