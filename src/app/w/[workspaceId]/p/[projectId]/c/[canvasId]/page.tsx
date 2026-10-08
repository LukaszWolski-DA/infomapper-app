import { placeCardAction, placeCardsAction, removeCardAction, removeCardsAction, updateCardAction } from "@/app/_actions/canvas-item";
import {
  createFrameAction,
  deleteFrameAction,
  fitFrameAction,
  moveOnCanvasAction,
  resizeFrameAction,
  updateFrameAction,
} from "@/app/_actions/frame";
import { saveCanvasLookAction } from "@/app/_actions/canvas";
import { AppShell } from "@/app/_components/app-shell";
import { MovedNotice } from "@/app/_components/moved-notice";
import { UndoButtons, UndoProvider } from "@/app/_components/undo";
import { loadProjectView } from "@/app/_lib/project-view";
import { canvasHref } from "@/app/_lib/paths";
import { loadShell } from "@/app/_lib/shell";
import { Inspector } from "@/app/_panels/inspector";
import { LeftPanel } from "@/app/_panels/left-panel";
import { PanelsProvider } from "@/app/_panels/panels-context";
import { StatusBar } from "@/app/_panels/status-bar";
import { buildTree } from "@/app/_panels/tree-data";
import { buildCards } from "@/canvas/card-data";
import { buildFrames, conceptColors } from "@/canvas/frame-data";
import { FrameToolButton } from "@/canvas/FrameToolButton";
import { buildLines } from "@/canvas/line-data";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { EntityToolButton } from "@/canvas/EntityToolButton";
import { HandToolButton } from "@/canvas/HandToolButton";
import { LayerSwitch } from "@/canvas/LayerSwitch";
import { CanvasLookProvider } from "@/canvas/look";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { NotationSwitch } from "@/canvas/NotationSwitch";
import { ZoomControls } from "@/canvas/ZoomControls";
import { getDataStore } from "@/data";
import { isMeasurementBuild } from "@/data/local/measure-mode";
import { lastContentEditor } from "@/domain/model/mapping-rules";

// Canvas page: tabs, the left panel (model and sources), the model canvas and the right panel (slice 1a); the Entity
// tool and Undo and Redo in the top bar (slice 1b); the Hand tool, a selection of several cards, the canvas's look and
// layer mode, and “On canvases” in the panels (slice 2a); frames and the Frame tool (slice 2b). `?card=entity:<id>` or `?card=source:<id>` selects that card
// and shows it on arrival; `?moved=1` says that the address you opened is no longer in this project.
export default async function CanvasPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceId]/p/[projectId]/c/[canvasId]">) {
  const { workspaceId, projectId, canvasId } = await params;
  const query = await searchParams;
  const renameOnOpen = query.rename === "1";
  const shell = await loadShell({ workspaceId, projectId, canvasId });
  const view = await loadProjectView(shell);
  const store = getDataStore();
  const ws = shell.workspace.id;
  const [model, allItems, canvases, workspace, history, projects, frameRows] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
    store.workspaces.get(ws),
    store.undoHistory.get(ws, shell.user.id),
    store.projects.list(ws),
    store.frames.listOfCanvas(ws, canvasId),
  ]);
  const frames = buildFrames(frameRows);
  const canvas = canvases.find((c) => c.id === canvasId)!;
  const undoState = { canUndo: history.undo.length > 0, canRedo: history.redo.length > 0 };
  // Four-eyes (AD-06): the panel says beforehand who may not approve; the server checks again.
  const fourEyes = !!workspace?.four_eyes;
  const events = fourEyes ? await store.changeEvents.list(ws) : [];
  const contentAuthors = Object.fromEntries(model.mappings.map((m) => [m.id, fourEyes ? lastContentEditor(m, events) : ""]).filter(([, u]) => u));
  const liveCanvases = new Set(canvases.map((c) => c.id));
  const items = allItems.filter((i) => liveCanvases.has(i.canvas_id));
  const cards = buildCards(model, items.filter((i) => i.canvas_id === canvasId));
  const tree = buildTree(model, items, canvasId, view.canvases.map((c) => c.id));
  const editable = shell.standing === "full";
  // measurement-only switches (slice 2a diagnosis): only in the measurement-only production build (AD-31)
  const diag = isMeasurementBuild() && typeof query.diag === "string" ? query.diag.split(",") : [];
  const focus = typeof query.card === "string" ? /^(entity|source):(.+)$/.exec(query.card) : null;
  const focusCardId = focus ? (cards.find((c) => c.kind === (focus[1] === "entity" ? "ent" : "src") && c.targetId === focus[2])?.id ?? null) : null;

  // “On canvases” (slice 2a): every canvas of the workspace and where it opens, and the canvases each element is on.
  // A canvas outside this project opens in the first project that has it (assumption 4).
  const projectOrder = new Map(projects.map((p, i) => [p.id, i]));
  const places = await Promise.all(
    canvases.map(async (c) => {
      const links = (await store.canvases.listLinksOfCanvas(ws, c.id)).sort((a, b) => (projectOrder.get(a.project_id) ?? 0) - (projectOrder.get(b.project_id) ?? 0));
      const here = links.some((l) => l.project_id === projectId);
      const project = here ? null : projects.find((p) => p.id === links[0]?.project_id);
      return {
        id: c.id,
        name: c.name,
        href: canvasHref(ws, project?.id ?? projectId, c.id),
        where: c.id === canvasId ? "this canvas" : here ? "open" : `in ${project?.name ?? ""}`,
        switchTo: project?.name ?? null,
      };
    }),
  );
  const canvasesOf: Record<string, string[]> = {};
  for (const i of items) {
    const target = i.entity_id ?? i.source_table_id;
    if (target) (canvasesOf[target] ??= []).push(i.canvas_id);
  }

  return (
    <CanvasProvider>
      <CanvasLookProvider
        key={canvasId}
        canvasId={canvasId}
        look={canvas.look}
        version={canvas.version}
        editable={editable}
        save={saveCanvasLookAction.bind(null, ws)}
      >
      <PanelsProvider>
        <UndoProvider workspaceId={ws} projectId={projectId} canvasId={canvasId} state={undoState}>
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
                  places={places}
                  canvasesOf={canvasesOf}
                />
              ),
              status: <StatusBar model={model} entityIds={cards.filter((c) => c.kind === "ent").map((c) => c.targetId)} />,
            }}
          >
            {query.moved === "1" && <MovedNotice project={view.project.name} canvas={canvas.name} />}
            <ModelCanvas
              key={canvasId}
              canvasId={canvasId}
              cards={cards}
              lines={buildLines(model, cards)}
              editable={editable}
              saveCard={updateCardAction.bind(null, ws)}
              placeCard={placeCardAction.bind(null, ws, canvasId)}
              placeCards={placeCardsAction.bind(null, ws, canvasId)}
              removeCard={removeCardAction.bind(null, ws)}
              removeCards={removeCardsAction.bind(null, ws, canvasId)}
              frames={frames}
              conceptColors={conceptColors(model)}
              frameWrites={{
                moveOnCanvas: moveOnCanvasAction.bind(null, ws, canvasId),
                createFrame: createFrameAction.bind(null, ws, canvasId),
                updateFrame: updateFrameAction.bind(null, ws),
                resizeFrame: resizeFrameAction.bind(null, ws),
                fitFrame: fitFrameAction.bind(null, ws),
                deleteFrame: deleteFrameAction.bind(null, ws),
              }}
              focusCardId={focusCardId}
              diagnosis={diag.length ? { noLines: diag.includes("nolines"), blocks: diag.includes("blocks") } : undefined}
            />
          </AppShell>
        </UndoProvider>
      </PanelsProvider>
      </CanvasLookProvider>
    </CanvasProvider>
  );
}

const CanvasTools = ({ editable }: { editable: boolean }) => (
  <>
    <LayerSwitch />
    {editable && <EntityToolButton />}
    {editable && <FrameToolButton />}
    <HandToolButton />
    <NotationSwitch />
    <UndoButtons />
    <ZoomControls />
  </>
);
