"use client";

// The right panel (prototype #ins). Step 4 of slice 1a: a selected card shows what it is, the entity's name (focused
// right after “+” created it, D-46) and “Remove from this canvas”. The rest of the panel comes in step 5.

import { useContext, useEffect, useRef } from "react";
import { renameEntityAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import { useToast } from "@/ui/components/toast";
import { usePanels } from "./panels-context";
import type { TreeData, TreeEntity } from "./tree-data";

export interface InspectorProps {
  workspaceId: string;
  tree: TreeData;
  editable: boolean;
}

/** The entity or source table behind a card of this canvas. */
function cardTarget(tree: TreeData, cardId: string) {
  for (const c of tree.concepts) {
    const e = c.entities.find((x) => x.cardId === cardId);
    if (e) return { kind: "ent" as const, entity: e };
  }
  for (const s of tree.systems) {
    for (const sc of s.schemas) {
      const t = sc.tables.find((x) => x.cardId === cardId);
      if (t) return { kind: "src" as const, table: t, path: `${s.name} / ${sc.name}` };
    }
  }
  return null;
}

export function Inspector({ workspaceId, tree, editable }: InspectorProps) {
  const { selection, remove } = useContext(CanvasUiCtx);
  const cardId = selection?.t === "card" ? selection.id : null;
  const target = cardId ? cardTarget(tree, cardId) : null;

  if (!cardId || !target) {
    return <div className="grid flex-1 place-items-center p-6 text-center text-xs text-im-ink-3">Details of what you select appear here in a later slice.</div>;
  }
  return (
    <div className="flex-1 overflow-auto px-4 pb-6 pt-4" data-testid="inspector-card">
      {target.kind === "ent" ? (
        <>
          <div className="mb-1.5 text-[11.5px] text-im-ink-3">Entity</div>
          <EntityName key={`${target.entity.id}:${target.entity.version}`} workspaceId={workspaceId} cardId={cardId} entity={target.entity} editable={editable} />
        </>
      ) : (
        <>
          <div className="mb-1.5 text-[11.5px] text-im-ink-3">Source table</div>
          <h2 className="font-mono text-[15px] font-semibold leading-tight">{target.table.name}</h2>
          <p className="mt-1 font-mono text-im-ink-3">{target.path}</p>
        </>
      )}
      {editable && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover"
            data-testid="button-remove-card"
            onClick={() => remove(cardId)}
          >
            Remove from this canvas
          </button>
        </div>
      )}
    </div>
  );
}

/** The name field (prototype f-en): saved when it changes; empty goes back; a duplicate name warns (B-25). */
function EntityName({ workspaceId, cardId, entity, editable }: { workspaceId: string; cardId: string; entity: TreeEntity; editable: boolean }) {
  const { run } = useAction();
  const toast = useToast();
  const { nameFocus, setNameFocus } = usePanels();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameFocus !== cardId) return;
    ref.current?.focus();
    ref.current?.select();
    setNameFocus(null);
  }, [nameFocus, cardId, setNameFocus]);

  async function save(input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name || name === entity.name) {
      input.value = entity.name;
      return;
    }
    const result = await run(() => renameEntityAction(workspaceId, { entityId: entity.id, expectedVersion: entity.version, name }));
    if (!result.ok) input.value = entity.name;
    else if (result.value.warning) toast(result.value.warning);
  }

  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs text-im-ink-2">Name</span>
      <input
        ref={ref}
        defaultValue={entity.name}
        readOnly={!editable}
        data-testid="input-entity-name"
        className="min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 outline-none focus:border-im-logical"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={(e) => editable && void save(e.currentTarget)}
      />
    </label>
  );
}
