"use client";

// The "New project" tile. The prototype creates a project called "New project" straight away; projects cannot be
// renamed in slice 0, so the tile asks for the name first (the same "name, then Enter" as the project switcher).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";

export function NewProjectTile({ workspaceId }: { workspaceId: string }) {
  const [editing, setEditing] = useState(false);
  const { run, pending } = useAction();
  const router = useRouter();

  async function create(name: string) {
    const result = await run(() => createProjectAction({ workspaceId, name }), `Created the project ${name.trim()}.`);
    if (result.ok) router.push(result.value.href);
  }

  if (!editing) {
    return (
      <button
        type="button"
        data-testid="tile-new-project"
        onClick={() => setEditing(true)}
        className="grid min-h-[200px] place-items-center rounded-[10px] bg-transparent font-medium text-im-ink-2 shadow-[inset_0_0_0_1.5px_var(--im-line)] hover:text-im-logical hover:shadow-[inset_0_0_0_1.5px_var(--im-logical)]"
      >
        <span className="flex flex-col items-center gap-1.5">
          <PlusIcon />
          New project
        </span>
      </button>
    );
  }
  return (
    <div className="grid min-h-[200px] place-items-center rounded-[10px] px-4 shadow-[inset_0_0_0_1.5px_var(--im-logical)]">
      <input
        autoFocus
        data-testid="input-new-project-tile"
        placeholder="New project name, then Enter"
        disabled={pending}
        className="h-[30px] w-full rounded-md border border-im-line bg-im-surface px-2"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && e.currentTarget.value.trim()) void create(e.currentTarget.value);
        }}
        onBlur={(e) => !e.currentTarget.value.trim() && setEditing(false)}
      />
    </div>
  );
}

export const PlusIcon = () => (
  <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]" aria-hidden>
    <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
  </svg>
);
