"use client";

// Canvas tabs above the canvas, as in the prototype: Home, one tab per canvas of the project (double-click to
// rename, ⋯ for options) and "New canvas". The rename keeps what was typed until its answer (slice 14b, D-66): after a
// refusal the field stays with slice 13's line on one row inside the tab (F4).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { renameCanvasAction } from "@/app/_actions/canvas";
import { useAction } from "@/app/_components/use-action";
import { DraftLine, useDraft } from "@/app/_panels/fields";
import { NAME_REQUIRED } from "@/domain/validation";
import { useToast } from "@/ui/components/toast";
import { canvasHref, projectHref } from "@/app/_lib/paths";
import type { ProjectView } from "@/app/_lib/project-view";
import { TagIcon } from "@/app/_panels/labels-field";
import { cn } from "@/ui/lib/utils";
import { CanvasMenu, DotsIcon, useNewCanvas } from "./canvas-menu";

const HomeIcon = () => (
  <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.5]" aria-hidden>
    <rect x="2" y="2.5" width="5" height="5" rx="1" />
    <rect x="9" y="2.5" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

const tabClass =
  "relative flex h-[31px] cursor-pointer select-none items-center gap-[7px] whitespace-nowrap rounded-t-[7px] text-im-ink-2 hover:bg-im-hover";
const onClass = "bg-im-canvas font-medium text-im-ink shadow-[inset_1px_1px_0_var(--im-line),inset_-1px_0_0_var(--im-line)] hover:bg-im-canvas";

export function CanvasTabs({
  view,
  currentCanvasId,
  renameOnOpen,
}: {
  view: ProjectView;
  currentCanvasId: string | null;
  renameOnOpen: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(renameOnOpen && view.canEdit ? currentCanvasId : null);
  const router = useRouter();
  const { create, pending } = useNewCanvas(view);

  function closeRename(canvas: ProjectView["canvases"][number]) {
    setRenaming((r) => (r === canvas.id ? null : r));
  }
  /**
   * Drops ?rename=1 the first time the field is left, before its save is sent, as before slice 14b: the router then
   * applies the save's page before a link clicked right after it (once the field closed on its answer, a late page took
   * the person back to the canvas from the project home, S0-06).
   */
  function leftRename(canvas: ProjectView["canvases"][number]) {
    const href = canvasHref(view.workspaceId, view.project.id, canvas.id);
    if (renameOnOpen && window.location.pathname === href && window.location.search.includes("rename=1")) router.replace(href);
  }

  return (
    <div
      role="tablist"
      aria-label="Canvases"
      data-testid="tabs-canvases"
      className="flex h-[38px] flex-none items-end gap-0.5 overflow-x-auto overflow-y-hidden bg-im-panel px-2 [background:linear-gradient(var(--im-line),var(--im-line))_bottom/100%_1px_no-repeat,var(--im-panel)] [scrollbar-width:none]"
    >
      <Link
        role="tab"
        aria-selected={currentCanvasId === null}
        href={projectHref(view.workspaceId, view.project.id)}
        title="Project home: all canvases of this project"
        data-testid="tab-home"
        className={cn(tabClass, "gap-1.5 px-3", currentCanvasId === null && onClass)}
      >
        <HomeIcon />
        <span>Home</span>
      </Link>

      {view.canvases.map((canvas) => {
        const on = canvas.id === currentCanvasId;
        return (
          <div
            key={canvas.id}
            role="tab"
            aria-selected={on}
            data-testid="tab-canvas"
            title={view.canEdit ? "Double-click to rename" : undefined}
            className={cn(tabClass, "group pl-3 pr-1", on && onClass)}
            // a click in the tab's menu (a portal) reaches this handler through React's tree: only a click on the tab itself
            // opens its canvas (slice 14b: on the save chain a delete is sent after this push, which then opened the
            // deleted canvas)
            onClick={(e) => e.currentTarget.contains(e.target as Node) && renaming !== canvas.id && router.push(canvasHref(view.workspaceId, view.project.id, canvas.id))}
            onDoubleClick={() => view.canEdit && setRenaming(canvas.id)}
          >
            {renaming === canvas.id ? (
              <TabRename view={view} canvas={canvas} onLeave={() => leftRename(canvas)} onClose={() => closeRename(canvas)} />
            ) : (
              <>
                {canvas.liveLabel && (
                  <span className="inline-flex text-im-ink-3" title={`Live canvas: shows everything labeled ${canvas.liveLabel}`} data-testid="tab-canvas-live">
                    <TagIcon />
                  </span>
                )}
                <span className="max-w-[200px] truncate" data-testid="tab-canvas-name">
                  {canvas.name}
                </span>
              </>
            )}
            <span className="text-[10.5px] font-normal tabular-nums text-im-ink-3" data-testid="tab-canvas-count">
              {canvas.cards}
            </span>
            {view.canEdit ? (
              <CanvasMenu
                view={view}
                canvas={canvas}
                currentCanvasId={currentCanvasId}
                onRename={() => {
                  if (!on) router.push(`${canvasHref(view.workspaceId, view.project.id, canvas.id)}?rename=1`);
                  else setRenaming(canvas.id);
                }}
                trigger={
                  <button
                    type="button"
                    title="Canvas options"
                    aria-label={`Options for ${canvas.name}`}
                    data-testid="button-canvas-menu"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "grid size-6 place-items-center rounded text-im-ink-2 hover:bg-im-hover hover:text-im-ink",
                      on ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                    )}
                  >
                    <DotsIcon />
                  </button>
                }
              />
            ) : (
              <span className="w-1" />
            )}
          </div>
        );
      })}

      {view.canEdit && (
        <button
          type="button"
          title="Create an empty canvas over the same model"
          data-testid="button-new-canvas"
          disabled={pending}
          onClick={() => void create()}
          className="mb-[3px] inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-md px-[9px] text-im-ink-2 hover:bg-im-hover hover:text-im-ink"
        >
          <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" aria-hidden>
            <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
          </svg>
          New canvas
        </button>
      )}
    </div>
  );
}

/**
 * A canvas's name in its tab (slice 14b, items 4–5): slice 13's draft (`useDraft`) saved on the save chain of the
 * canvas's row. The field stays until its answer: a stored name closes it; a refusal keeps the typed name with its mark
 * on one row after the field (the conflict line, "Not saved", or read-only "Not saved. You can still copy it."). Escape
 * puts the stored name back ("Use this" during a conflict) and closes it; an empty name goes back with "Enter a name.".
 */
function TabRename({ view, canvas, onLeave, onClose }: { view: ProjectView; canvas: ProjectView["canvases"][number]; onLeave: () => void; onClose: () => void }) {
  const toast = useToast();
  const { saveRow } = useAction();
  const save = async (name: string) => {
    const result = await saveRow(canvas, (v) => renameCanvasAction({ workspaceId: view.workspaceId, canvasId: canvas.id, expectedVersion: v, name }), `Renamed the canvas to ${name}.`);
    // stored, or the canvas is gone (its page goes where D-38 says)
    if (result.ok || result.code === "not_found") onClose();
    return result;
  };
  const readOnly = !view.canEdit;
  const { bind, defaultValue, commit, keyDown: draftKeyDown, mark, takeStored, keepMine } = useDraft<HTMLInputElement>(canvas.name, save, { prepare: (t) => t.trim(), required: true, onEmpty: () => toast(NAME_REQUIRED, "refusal"), readOnly });

  const leave = (el: HTMLInputElement) => {
    onLeave();
    // a conflict is settled by "Use this" or "Keep mine", never by leaving (D-66); a read-only draft only closes
    if (mark?.kind === "conflict") return;
    if (readOnly || mark?.kind === "copy") return onClose();
    const name = el.value.trim();
    commit();
    // nothing to send (the stored name, or empty: back to it with the toast): the field closes; a sent save closes it
    // on its answer
    if (!name || name === canvas.name) onClose();
  };
  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      onLeave();
      draftKeyDown(e);
      onClose();
    }
  };
  return (
    <>
      <input
        ref={bind}
        autoFocus
        aria-label="Canvas name"
        data-testid="input-canvas-name"
        defaultValue={defaultValue}
        readOnly={readOnly || mark?.kind === "copy"}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
        onBlur={(e) => leave(e.currentTarget)}
        className="h-6 w-[180px] rounded border border-im-logical bg-im-surface px-1.5 font-medium read-only:border-im-line"
      />
      <DraftLine
        inline
        mark={mark}
        onUse={() => {
          takeStored();
          onClose();
        }}
        onKeep={keepMine}
      />
    </>
  );
}
