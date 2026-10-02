"use client";

// Canvas tiles on the project home: open, ⋯ menu (Rename, In projects), "New canvas" and
// "Add a canvas from another project".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addCanvasToProjectAction } from "@/app/_actions/canvas";
import { useAction } from "@/app/_components/use-action";
import { canvasHref } from "@/app/_lib/paths";
import type { ProjectView } from "@/app/_lib/project-view";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";
import { CanvasMenu, DotsIcon, itemClass, menuClass, useNewCanvas } from "./canvas-menu";

const addTileClass =
  "grid min-h-[200px] place-items-center rounded-[10px] bg-transparent font-medium text-im-ink-2 shadow-[inset_0_0_0_1.5px_var(--im-line)] hover:text-im-logical hover:shadow-[inset_0_0_0_1.5px_var(--im-logical)] data-[state=open]:text-im-logical";

export function CanvasTiles({ view }: { view: ProjectView }) {
  const router = useRouter();
  const { create, pending } = useNewCanvas(view);
  const { run } = useAction();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" data-testid="tiles-canvases">
      {view.canvases.map((canvas) => {
        const href = canvasHref(view.workspaceId, view.project.id, canvas.id);
        const also = view.projects.filter((p) => p.id !== view.project.id && canvas.projectIds.includes(p.id));
        return (
          <div
            key={canvas.id}
            data-testid="tile-canvas"
            className="group relative overflow-hidden rounded-[10px] bg-im-surface shadow-[0_0_0_1px_var(--im-line),0_6px_16px_-12px_var(--im-shadow)] hover:shadow-[0_0_0_2px_var(--im-logical),0_10px_24px_-14px_var(--im-shadow)]"
          >
            <Link href={href} className="block text-left">
              <span className="block h-[140px] border-b border-im-line bg-im-canvas" />
              <span className="block truncate px-3 pb-0.5 pt-2.5 text-[13.5px] font-semibold" data-testid="tile-canvas-name">
                {canvas.name}
              </span>
              <span className="block px-3 pb-3 text-[11.5px] text-im-ink-3">
                0 cards{also.length ? `. Also in ${also.map((p) => p.name).join(", ")}` : ""}
              </span>
            </Link>
            {view.canEdit && (
              <div className="absolute right-1.5 top-1.5">
                <CanvasMenu
                  view={view}
                  canvas={canvas}
                  currentCanvasId={null}
                  onRename={() => router.push(`${href}?rename=1`)}
                  trigger={
                    <button
                      type="button"
                      title="Canvas options"
                      aria-label={`Options for ${canvas.name}`}
                      data-testid="button-canvas-menu"
                      className="grid size-7 place-items-center rounded-md bg-im-surface text-im-ink-2 opacity-0 shadow-[0_0_0_1px_var(--im-line)] hover:text-im-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <DotsIcon />
                    </button>
                  }
                />
              </div>
            )}
          </div>
        );
      })}

      {view.canEdit && (
        <button type="button" data-testid="tile-new-canvas" className={addTileClass} disabled={pending} onClick={() => void create()}>
          <span className="flex flex-col items-center gap-1.5">
            <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" aria-hidden>
              <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
            </svg>
            New canvas
          </span>
        </button>
      )}

      {view.canEdit && view.outside.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={addTileClass} data-testid="tile-add-canvas">
            <span className="flex flex-col items-center gap-1.5">
              <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" aria-hidden>
                <path d="M2.5 8h11M9.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add a canvas from another project
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuClass + " min-w-[230px]"} data-testid="menu-add-canvas">
            <DropdownMenuLabel className="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-im-ink-2">
              Add to {view.project.name}
            </DropdownMenuLabel>
            <p className="mx-2.5 mb-1.5 max-w-[260px] text-[11.5px] text-im-ink-3">
              The canvas stays in its other projects too; it is the same canvas, not a copy.
            </p>
            {view.outside.map((c) => (
              <DropdownMenuItem
                key={c.id}
                className={itemClass}
                data-testid="menu-item-add-canvas"
                onSelect={() =>
                  void run(
                    () => addCanvasToProjectAction({ workspaceId: view.workspaceId, canvasId: c.id, projectId: view.project.id }),
                    `${c.name} is now also in ${view.project.name}.`,
                  )
                }
              >
                <span className="truncate">{c.name}</span>
                <kbd className="text-[10.5px] font-normal text-im-ink-3">{c.projectNames.join(", ")}</kbd>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
