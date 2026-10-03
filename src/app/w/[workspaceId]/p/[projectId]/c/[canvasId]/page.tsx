import { placeCardAction, removeCardAction, updateCardAction } from "@/app/_actions/canvas-item";
import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";
import { Inspector } from "@/app/_panels/inspector";
import { LeftPanel } from "@/app/_panels/left-panel";
import { PanelsProvider } from "@/app/_panels/panels-context";
import { buildTree } from "@/app/_panels/tree-data";
import { buildCards } from "@/canvas/card-data";
import { buildLines } from "@/canvas/line-data";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { NotationSwitch } from "@/canvas/NotationSwitch";
import { ZoomControls } from "@/canvas/ZoomControls";
import { getDataStore } from "@/data";

// Canvas page: tabs, the left panel (model and sources), the model canvas and the right panel (slice 1a).
export default async function CanvasPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceId]/p/[projectId]/c/[canvasId]">) {
  const { workspaceId, projectId, canvasId } = await params;
  const renameOnOpen = (await searchParams).rename === "1";
  const shell = await loadShell({ workspaceId, projectId, canvasId });
  const view = await loadProjectView(shell);
  const store = getDataStore();
  const ws = shell.workspace.id;
  const [model, allItems, canvases] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
  ]);
  const liveCanvases = new Set(canvases.map((c) => c.id));
  const items = allItems.filter((i) => liveCanvases.has(i.canvas_id));
  const cards = buildCards(model, items.filter((i) => i.canvas_id === canvasId));
  const tree = buildTree(model, items, canvasId, view.canvases.map((c) => c.id));
  const editable = shell.standing === "full";

  return (
    <CanvasProvider>
      <PanelsProvider>
        <AppShell
          shell={shell}
          project={{
            view,
            currentCanvasId: canvasId,
            renameOnOpen,
            tools: <CanvasTools />,
            left: <LeftPanel workspaceId={ws} canvasId={canvasId} tree={tree} editable={editable} />,
            right: <Inspector workspaceId={ws} tree={tree} editable={editable} />,
          }}
        >
          <ModelCanvas
            key={canvasId}
            canvasId={canvasId}
            cards={cards}
            lines={buildLines(model, cards)}
            editable={editable}
            saveCard={updateCardAction.bind(null, ws)}
            placeCard={placeCardAction.bind(null, ws, canvasId)}
            removeCard={removeCardAction.bind(null, ws)}
          />
        </AppShell>
      </PanelsProvider>
    </CanvasProvider>
  );
}

const CanvasTools = () => (
  <>
    <NotationSwitch />
    <ZoomControls />
  </>
);
