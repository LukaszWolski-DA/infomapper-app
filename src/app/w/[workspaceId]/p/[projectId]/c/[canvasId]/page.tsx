import { updateCardAction } from "@/app/_actions/canvas-item";
import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";
import { buildCards } from "@/canvas/card-data";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { ZoomControls } from "@/canvas/ZoomControls";
import { getDataStore } from "@/data";

// Canvas page: tabs, panels (still empty) and the model canvas (slice 1a).
export default async function CanvasPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceId]/p/[projectId]/c/[canvasId]">) {
  const { workspaceId, projectId, canvasId } = await params;
  const renameOnOpen = (await searchParams).rename === "1";
  const shell = await loadShell({ workspaceId, projectId, canvasId });
  const view = await loadProjectView(shell);
  const store = getDataStore();
  const [model, items] = await Promise.all([
    store.model.load(shell.workspace.id),
    store.canvasItems.listOfCanvas(shell.workspace.id, canvasId),
  ]);

  return (
    <CanvasProvider>
      <AppShell shell={shell} project={{ view, currentCanvasId: canvasId, renameOnOpen, tools: <ZoomControls /> }}>
        <ModelCanvas
          key={canvasId}
          canvasId={canvasId}
          cards={buildCards(model, items)}
          editable={shell.standing === "full"}
          saveCard={updateCardAction.bind(null, shell.workspace.id)}
        />
      </AppShell>
    </CanvasProvider>
  );
}
