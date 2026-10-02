"use client";

// Canvas options, as in the prototype's canvas menu: Rename and "In projects" (D-28).
// Duplicate layout, background, grid and delete belong to later slices.

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  addCanvasToProjectAction,
  createCanvasAction,
  removeCanvasFromProjectAction,
} from "@/app/_actions/canvas";
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
