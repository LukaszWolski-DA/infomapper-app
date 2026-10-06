"use client";

// Canvas options, as in the prototype's canvas menu: Rename and "In projects" (D-28); slice 2a adds Duplicate layout,
// the look (background, grid, "Use this look on all canvases", D-12) and, last, Delete canvas or Remove from this
// project (D-28). A look change on the open canvas shows at once (`look.tsx`).

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  addCanvasToProjectAction,
  applyLookToAllCanvasesAction,
  createCanvasAction,
  deleteCanvasAction,
  duplicateCanvasAction,
  removeCanvasFromProjectAction,
  setCanvasLookAction,
} from "@/app/_actions/canvas";
import { LookControls, useCanvasLook, type LookPatch } from "@/canvas/look";
import { copyView } from "@/canvas/views";
import { useAction } from "@/app/_components/use-action";
import { canvasHref } from "@/app/_lib/paths";
import type { ProjectView } from "@/app/_lib/project-view";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";

export const menuClass =
  "min-w-[200px] max-w-[300px] rounded-lg border-0 bg-im-surface p-1 text-[13px] text-im-ink shadow-[0_0_0_1px_var(--im-line),0_12px_28px_-10px_var(--im-shadow)]";
export const itemClass =
  "flex cursor-pointer items-center justify-between gap-4 rounded-[5px] px-2.5 py-[7px] focus:bg-im-hover data-[highlighted]:bg-im-hover";
export const sectionClass = "px-2.5 pb-1 pt-1.5 text-[11px] font-normal text-im-ink-3";

export const DotsIcon = () => (
  <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
    <circle cx="3.5" cy="8" r="1" />
    <circle cx="8" cy="8" r="1" />
    <circle cx="12.5" cy="8" r="1" />
  </svg>
);

type Canvas = ProjectView["canvases"][number];

export function CanvasMenu({
  view,
  canvas,
  currentCanvasId,
  onRename,
  trigger,
}: {
  view: ProjectView;
  canvas: Canvas;
  currentCanvasId: string | null;
  onRename: () => void;
  trigger: ReactNode;
}) {
  const { run } = useAction();
  const router = useRouter();
  const lookApi = useCanvasLook();
  const open = lookApi?.canvasId === canvas.id ? lookApi : null;
  const look = open?.look ?? canvas.look;
  const others = view.projects.filter((p) => p.id !== view.project.id && canvas.projectIds.includes(p.id));
  const isLast = view.canvases.length < 2;

  function setLook(patch: LookPatch) {
    if (open) open.setLook(patch);
    else void run(() => setCanvasLookAction({ workspaceId: view.workspaceId, canvasId: canvas.id, expectedVersion: canvas.version, ...patch }));
  }

  async function duplicate() {
    const result = await run(
      () => duplicateCanvasAction({ workspaceId: view.workspaceId, projectId: view.project.id, canvasId: canvas.id }),
      `Duplicated ${canvas.name}. Only the layout is copied; the model is shared.`,
      { undoable: true },
    );
    if (!result.ok) return;
    copyView(canvas.id, result.value.canvasId);
    router.push(result.value.href);
  }

  async function remove() {
    const result = await run(
      () => deleteCanvasAction({ workspaceId: view.workspaceId, projectId: view.project.id, canvasId: canvas.id, expectedVersion: canvas.version }),
      others.length
        ? `Took ${canvas.name} out of ${view.project.name}. It is still in ${others.map((p) => p.name).join(", ")}.`
        : `Deleted the canvas ${canvas.name}. The model and its mappings are untouched.`,
      { undoable: true },
    );
    // The open canvas went: the next canvas of the project opens.
    if (result.ok && canvas.id === currentCanvasId) {
      const next = view.canvases.find((c) => c.id !== canvas.id);
      if (next) router.push(canvasHref(view.workspaceId, view.project.id, next.id));
    }
  }

  async function toggle(projectId: string, on: boolean) {
    const project = view.projects.find((p) => p.id === projectId)!;
    const input = { workspaceId: view.workspaceId, canvasId: canvas.id, projectId };
    if (on) {
      const others = view.projects.filter((p) => p.id !== projectId && canvas.projectIds.includes(p.id));
      const result = await run(
        () => removeCanvasFromProjectAction(input),
        `Took ${canvas.name} out of ${project.name}. It is still in ${others.map((p) => p.name).join(", ")}.`,
      );
      // Taking the open canvas out of this project: show another canvas of the project.
      if (result.ok && projectId === view.project.id && canvas.id === currentCanvasId) {
        const next = view.canvases.find((c) => c.id !== canvas.id);
        if (next) router.push(canvasHref(view.workspaceId, view.project.id, next.id));
      }
    } else {
      await run(() => addCanvasToProjectAction(input), `${canvas.name} is now also in ${project.name}.`);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={menuClass}
        data-testid="menu-canvas"
        // keep focus where "Rename" puts it (the name field), not back on the ⋯ button
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem className={itemClass} onSelect={onRename} data-testid="menu-item-rename">
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => void duplicate()} data-testid="menu-item-duplicate">
          Duplicate layout
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <DropdownMenuLabel className={sectionClass}>Background</DropdownMenuLabel>
        <div className="px-1.5 pb-1">
          <LookControls part="background" look={look} onChange={setLook} />
        </div>
        <DropdownMenuLabel className={sectionClass}>Grid</DropdownMenuLabel>
        <div className="mx-2 mb-1.5">
          <LookControls part="grid" look={look} onChange={setLook} />
        </div>
        <DropdownMenuItem
          className={itemClass}
          data-testid="menu-item-look-all"
          onSelect={() => void run(() => applyLookToAllCanvasesAction({ workspaceId: view.workspaceId, canvasId: canvas.id }), "All canvases now use this look.")}
        >
          Use this look on all canvases
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <DropdownMenuLabel className={sectionClass}>In projects</DropdownMenuLabel>
        {view.projects.map((p) => {
          const on = canvas.projectIds.includes(p.id);
          return (
            <DropdownMenuItem
              key={p.id}
              role="menuitemcheckbox"
              aria-checked={on}
              data-testid="menu-item-in-project"
              className={itemClass + " justify-start gap-1.5"}
              onSelect={(e) => {
                e.preventDefault(); // stay open, as in the prototype
                void toggle(p.id, on);
              }}
            >
              <span aria-hidden>{on ? "☑" : "☐"}</span>
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <DropdownMenuItem
          className={itemClass + " text-im-warn focus:text-im-warn data-[disabled]:pointer-events-none data-[disabled]:opacity-50"}
          disabled={isLast}
          title={isLast ? "A project keeps at least one canvas." : undefined}
          onSelect={() => void remove()}
          data-testid="menu-item-delete-canvas"
        >
          {others.length ? "Remove from this project" : "Delete canvas"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "New canvas": an empty canvas named "Untitled canvas N", opened with its name ready to edit (prototype). */
export function useNewCanvas(view: ProjectView) {
  const { run, pending } = useAction();
  const router = useRouter();
  const create = async () => {
    const name = `Untitled canvas ${view.canvases.length + 1}`;
    const result = await run(
      () => createCanvasAction({ workspaceId: view.workspaceId, projectId: view.project.id, name }),
      `Created the canvas ${name}.`,
    );
    if (result.ok) router.push(`${result.value.href}?rename=1`);
  };
  return { create, pending };
}
