"use client";

// Canvas tabs above the canvas, as in the prototype: Home, one tab per canvas of the project (double-click to
// rename, ⋯ for options) and "New canvas".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { renameCanvasAction } from "@/app/_actions/canvas";
import { useAction } from "@/app/_components/use-action";
import { canvasHref, projectHref } from "@/app/_lib/paths";
import type { ProjectView } from "@/app/_lib/project-view";
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
  const { run } = useAction();
  const router = useRouter();
  const { create, pending } = useNewCanvas(view);

  async function rename(canvas: ProjectView["canvases"][number], value: string) {
    setRenaming(null);
    if (renameOnOpen) router.replace(canvasHref(view.workspaceId, view.project.id, canvas.id)); // drop ?rename=1
    const name = value.trim();
    if (!name || name === canvas.name) return;
    await run(
      () => renameCanvasAction({ workspaceId: view.workspaceId, canvasId: canvas.id, expectedVersion: canvas.version, name }),
      `Renamed the canvas to ${name}.`,
    );
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
            onClick={() => renaming !== canvas.id && router.push(canvasHref(view.workspaceId, view.project.id, canvas.id))}
            onDoubleClick={() => view.canEdit && setRenaming(canvas.id)}
          >
            {renaming === canvas.id ? (
              <input
                autoFocus
                aria-label="Canvas name"
                data-testid="input-canvas-name"
                defaultValue={canvas.name}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = canvas.name;
                    e.currentTarget.blur();
                  }
                }}
                onBlur={(e) => void rename(canvas, e.currentTarget.value)}
                className="h-6 w-[180px] rounded border border-im-logical bg-im-surface px-1.5 font-medium"
              />
            ) : (
              <span className="max-w-[200px] truncate" data-testid="tab-canvas-name">
                {canvas.name}
              </span>
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
