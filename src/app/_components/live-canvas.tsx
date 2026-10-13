"use client";

// Opening a label's live canvas (slice 3b, PRD item 6) from the label panel or the project home: the server makes it
// the first time (or adds it to this project), then the browser goes there with the prototype's toast.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { openLiveCanvasAction } from "@/app/_actions/live";
import { useToast } from "@/ui/components/toast";
import { canvasHref } from "../_lib/paths";
import { useAction } from "./use-action";

export function useOpenLiveCanvas(workspaceId: string, projectId: string) {
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useAction();
  const open = useCallback(
    async (labelId: string) => {
      const r = await run(() => openLiveCanvasAction(workspaceId, { labelId, projectId }));
      if (!r.ok) return;
      const { canvasId, name, created, addedToProject, projectName } = r.value;
      router.push(canvasHref(workspaceId, projectId, canvasId));
      if (created) toast(`Live canvas for ${name}. It follows the label: what you label appears here, what you unlabel disappears.`);
      else if (addedToProject) toast(`Added the live canvas ${name} to ${projectName}.`);
    },
    [run, workspaceId, projectId, router, toast],
  );
  return { open, pending };
}
