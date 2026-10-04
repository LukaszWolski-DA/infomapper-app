import { placeCardAction, removeCardAction, updateCardAction } from "@/app/_actions/canvas-item";
import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";
import { Inspector } from "@/app/_panels/inspector";
import { LeftPanel } from "@/app/_panels/left-panel";
import { PanelsProvider } from "@/app/_panels/panels-context";
import { StatusBar } from "@/app/_panels/status-bar";
import { buildTree } from "@/app/_panels/tree-data";
import { buildCards } from "@/canvas/card-data";
import { buildLines } from "@/canvas/line-data";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { EntityToolButton } from "@/canvas/EntityToolButton";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { NotationSwitch } from "@/canvas/NotationSwitch";
import { ZoomControls } from "@/canvas/ZoomControls";
import { getDataStore } from "@/data";
import { lastContentEditor } from "@/domain/model/mapping-rules";

// Canvas page: tabs, the left panel (model and sources), the model canvas and the right panel (slice 1a); the Entity
// tool in the top bar (slice 1b).
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
  const [model, allItems, canvases, workspace] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
    store.workspaces.get(ws),
  ]);
  // Four-eyes (AD-06): the panel says beforehand who may not approve; the server checks again.
  const fourEyes = !!workspace?.four_eyes;
  const events = fourEyes ? await store.changeEvents.list(ws) : [];
  const contentAuthors = Object.fromEntries(model.mappings.map((m) => [m.id, fourEyes ? lastContentEditor(m, events) : ""]).filter(([, u]) => u));
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
            tools: <CanvasTools editable={editable} />,
            left: <LeftPanel workspaceId={ws} canvasId={canvasId} tree={tree} editable={editable} />,
            right: (
              <Inspector
                workspaceId={ws}
                canvasId={canvasId}
                canvasName={shell.canvas?.name ?? ""}
                canvasCount={canvases.length}
                model={model}
                cards={cards.map((c) => ({ id: c.id, kind: c.kind, targetId: c.targetId, collapsed: c.collapsed, rowFilter: c.rowFilter }))}
                tree={tree}
                editable={editable}
                canSetStatus={shell.standing !== "none"}
                userId={shell.user.id}
                fourEyes={fourEyes}
                contentAuthors={contentAuthors}
              />
            ),
            status: <StatusBar model={model} entityIds={cards.filter((c) => c.kind === "ent").map((c) => c.targetId)} />,
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

const CanvasTools = ({ editable }: { editable: boolean }) => (
  <>
    {editable && <EntityToolButton />}
    <NotationSwitch />
    <ZoomControls />
  </>
);
