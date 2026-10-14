import { placeCardAction, placeCardsAction, removeCardAction, removeCardsAction, updateCardAction } from "@/app/_actions/canvas-item";
import {
  arrangeIntoFramesAction,
  createFrameAction,
  deleteFrameAction,
  fitFrameAction,
  moveOnCanvasAction,
  putInNewFrameAction,
  resizeFrameAction,
  setAllFramesCollapsedAction,
  setFrameCollapsedAction,
  updateFrameAction,
} from "@/app/_actions/frame";
import { saveCanvasLookAction } from "@/app/_actions/canvas";
import { labelForLiveCanvasAction, removeFromLiveCanvasAction } from "@/app/_actions/live";
import { liveNoticesFor } from "@/app/_lib/live-notices";
import { createNoteAction, deleteNoteAction, moveNoteAction, moveNotesAction, pinNoteAction, unpinNoteAction, updateNoteAction } from "@/app/_actions/note";
import { AppShell } from "@/app/_components/app-shell";
import { MovedNotice } from "@/app/_components/moved-notice";
import { UndoButtons, UndoProvider } from "@/app/_components/undo";
import { WorkingContextButton, WorkingContextProvider } from "@/app/_components/working-context";
import { loadProjectView } from "@/app/_lib/project-view";
import { canvasHref } from "@/app/_lib/paths";
import { loadShell } from "@/app/_lib/shell";
import { Inspector } from "@/app/_panels/inspector";
import { LeftPanel } from "@/app/_panels/left-panel";
import { PanelsProvider } from "@/app/_panels/panels-context";
import { StatusBar } from "@/app/_panels/status-bar";
import { buildTree } from "@/app/_panels/tree-data";
import { buildCards } from "@/canvas/card-data";
import { buildFrames, conceptsOf } from "@/canvas/frame-data";
import { FrameToolButton } from "@/canvas/FrameToolButton";
import { buildLines } from "@/canvas/line-data";
import { buildNotes } from "@/canvas/note-data";
import { NoteToolButton } from "@/canvas/NoteToolButton";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { EntityToolButton } from "@/canvas/EntityToolButton";
import { HandToolButton } from "@/canvas/HandToolButton";
import { LayerSwitch } from "@/canvas/LayerSwitch";
import { CanvasLookProvider } from "@/canvas/look";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { TestHooks } from "@/canvas/TestHooks";
import { NotationSwitch } from "@/canvas/NotationSwitch";
import { ZoomControls } from "@/canvas/ZoomControls";
import { getDataStore } from "@/data";
import { areTestHooksOn, isMeasurementBuild } from "@/data/local/measure-mode";
import { labelItemCounts, labelNamesByItem } from "@/domain/model/labels";
import { liveMembership, liveRemoveQuestion, liveRemoveWhat } from "@/domain/model/live";
import { contextCookieName, parseContextCookie } from "@/ui/working-context-cookie";
import { cookies } from "next/headers";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { lastRequirementEditor } from "@/domain/model/requirements";
import { RememberLastCanvas } from "@/app/_lib/last-canvas";

// Canvas page: tabs, the left panel (model and sources), the model canvas and the right panel (slice 1a); the Entity
// tool and Undo and Redo in the top bar (slice 1b); the Hand tool, a selection of several cards, the canvas's look and
// layer mode, and “On canvases” in the panels (slice 2a); frames and the Frame tool (slice 2b); working labels: their
// marks on the canvas, the Labels field and the label panel, notes on the canvas (slice 3a). `?card=entity:<id>` or `?card=source:<id>` selects that card
// and shows it on arrival, `?label=<id>` opens that label's panel, `?note=<id>` selects that note (the project home's open
// notes); `?moved=1` says that the address you opened is no longer in this project.
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
  // when the data is read: a page that arrives late must not put back an older state, nor hide a card, frame or note
  // created after it (slice 3a step 5, slice 3b step 1: `mergeFresh`)
  const readAt = new Date().toISOString();
  const [model, allItems, canvases, workspace, history, projects, frameRows, labels, labelLinks, noteRows, users, requirements, requirementLinks] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
    store.workspaces.get(ws),
    store.undoHistory.get(ws, shell.user.id),
    store.projects.list(ws),
    store.frames.list(ws),
    store.labels.list(ws),
    store.labels.listLinks(ws),
    store.notes.listOfCanvas(ws, canvasId),
    store.users.list(),
    store.requirements.list(ws),
    store.requirements.listLinks(ws),
  ]);
  // measurement-only switches (slice 2a diagnosis): only in the measurement-only production build (AD-31); slice 3a:
  // `nolabelmarks` draws no label mark (rows, headers, lines), `nonotes` no note
  const diag = isMeasurementBuild() && typeof query.diag === "string" ? query.diag.split(",") : [];
  const labelNames = diag.includes("nolabelmarks") ? new Map<string, string[]>() : labelNamesByItem(labels, labelLinks);
  const frames = buildFrames(frameRows.filter((f) => f.canvas_id === canvasId));
  const conceptFrames: Record<string, number> = {};
  for (const f of frameRows) if (f.concept_id && canvases.some((c) => c.id === f.canvas_id)) conceptFrames[f.concept_id] = (conceptFrames[f.concept_id] ?? 0) + 1;
  const canvas = canvases.find((c) => c.id === canvasId)!;
  const undoState = { canUndo: history.undo.length > 0, canRedo: history.redo.length > 0 };
  // Four-eyes (AD-06): the panel says beforehand who may not approve; the server checks again.
  const fourEyes = !!workspace?.four_eyes;
  const events = fourEyes ? await store.changeEvents.list(ws) : [];
  const contentAuthors = Object.fromEntries(model.mappings.map((m) => [m.id, fourEyes ? lastContentEditor(m, events) : ""]).filter(([, u]) => u));
  const liveCanvases = new Set(canvases.map((c) => c.id));
  const items = allItems.filter((i) => liveCanvases.has(i.canvas_id));
  // a live canvas (slice 3b): its label, what that label makes relevant (computed once here, never while rendering),
  // and the mappings that carry it (the others are drawn faded)
  const liveLabel = canvas.live_label_id ? (labels.find((l) => l.id === canvas.live_label_id && l.deleted_at === null) ?? null) : null;
  const liveLinks = liveLabel ? labelLinks.filter((k) => k.deleted_at === null) : [];
  const membership = liveLabel ? liveMembership(liveLabel.id, { ...model, links: liveLinks }) : null;
  const liveMappings = liveLabel ? new Set(liveLinks.filter((k) => k.label_id === liveLabel.id && k.mapping_id).map((k) => k.mapping_id!)) : null;
  const cards = buildCards(model, items.filter((i) => i.canvas_id === canvasId), labelNames,     liveLabel && membership
      ? {
          labelName: liveLabel.name,
          relevantRows: membership.relevantRows,
          removeOf: (target) => {
            const q = liveRemoveQuestion(liveLabel.id, target, { ...model, links: liveLinks });
            return { direct: !!q.direct, what: liveRemoveWhat(q, target.kind), others: q.viaRows.length + q.viaMappings.length };
          },
        }
      : null,
  );
  // requirements (slice 4a): the index is built once per page here for the left panel; the panels build theirs once
  // per data version in the browser
  const requirementIndex = buildRequirementIndex(requirements, requirementLinks, model);
  const tree = buildTree(model, items, canvasId, view.canvases.map((c) => c.id), requirementIndex);
  // the status bar's requirements for the whole workspace (PRD item 31), and who last changed each requirement's content
  // for the panel's four-eyes hint (AD-06; only with four-eyes on, the server checks again)
  const requirementCounts = { count: requirementIndex.requirements.length, covered: requirementIndex.coveredCount };
  const requirementAuthors = fourEyes ? Object.fromEntries(requirementIndex.requirements.map((r) => [r.id, lastRequirementEditor(r, events)])) : {};
  const editable = shell.standing === "full";
  // the working context (slice 3b): for those who change labels (AD-05: the same roles as model editors), from this
  // person's browser; the labels with how many items each marks, for its menu and the status bar
  const itemCounts = labelItemCounts(labelLinks);
  const countedLabels = labels.filter((l) => l.deleted_at === null).map((l) => ({ id: l.id, name: l.name, items: itemCounts.get(l.id) ?? 0 }));
  const contextCookie = parseContextCookie((await cookies()).get(contextCookieName(shell.user.id, ws))?.value);
  // notes: editors and reviewers write them (Łukasz's step 0 answer 1); readers and an archived workspace only read
  const canNote = shell.standing !== "none";
  const userName = (id: string) => users.find((u) => u.id === id)?.display_name ?? "someone";
  const notes = diag.includes("nonotes") ? [] : buildNotes(noteRows, frameRows.filter((f) => f.canvas_id === canvasId), userName);
  const focus = typeof query.card === "string" ? /^(entity|source):(.+)$/.exec(query.card) : null;
  const focusCardId = focus ? (cards.find((c) => c.kind === (focus[1] === "entity" ? "ent" : "src") && c.targetId === focus[2])?.id ?? null) : null;
  const focusLabelId = typeof query.label === "string" && labels.some((l) => l.id === query.label) ? query.label : null;
  // `?req=<id>`: the project home's requirements open this canvas with the requirement's panel (slice 4a)
  const focusRequirementId = typeof query.req === "string" && requirementIndex.byId.has(query.req) ? query.req : null;
  const focusNoteId = typeof query.note === "string" && noteRows.some((n) => n.id === query.note) ? query.note : null;

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
    <CanvasProvider userId={shell.user.id}>
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
          <WorkingContextProvider workspaceId={ws} userId={shell.user.id} labels={countedLabels} initial={contextCookie} canLabel={editable}>
          <AppShell
            shell={shell}
            project={{
              view,
              currentCanvasId: canvasId,
              renameOnOpen,
              tools: <CanvasTools editable={editable} canNote={canNote} />,
              left: <LeftPanel workspaceId={ws} canvasId={canvasId} tree={tree} editable={editable} conceptFrames={conceptFrames} />,
              right: (
                <Inspector
                  workspaceId={ws}
                  canvasId={canvasId}
                  canvasName={shell.canvas?.name ?? ""}
                  canvasCount={canvases.length}
                  model={model}
                  cards={cards.map((c) => ({ id: c.id, kind: c.kind, targetId: c.targetId, collapsed: c.collapsed, rowFilter: c.rowFilter, liveLevel: c.liveLevel }))}
                  tree={tree}
                  editable={editable}
                  canSetStatus={shell.standing !== "none"}
                  canNote={canNote}
                  userId={shell.user.id}
                  fourEyes={fourEyes}
                  contentAuthors={contentAuthors}
                  places={places}
                  canvasesOf={canvasesOf}
                  labels={labels}
                  labelLinks={labelLinks}
                  requirements={requirements}
                  requirementLinks={requirementLinks}
                  requirementAuthors={requirementAuthors}
                  projectId={projectId}
                  liveCanvases={Object.fromEntries(canvases.filter((c) => c.live_label_id && c.deleted_at === null).map((c) => [c.live_label_id!, c.id]))}
                  live={liveLabel ? { labelId: liveLabel.id, labelName: liveLabel.name } : null}
                  canCreateCanvas={editable}
                />
              ),
              status: <StatusBar model={model} entityIds={cards.filter((c) => c.kind === "ent").map((c) => c.targetId)} requirements={requirementCounts} />,
            }}
          >
            {query.moved === "1" && <MovedNotice project={view.project.name} canvas={canvas.name} />}
            <RememberLastCanvas projectId={projectId} canvasId={canvasId} />
            {/* the measuring hook (slice 4p): e2e dev server and measurement build only */}
            {areTestHooksOn() && <TestHooks />}
            <ModelCanvas
              key={canvasId}
              canvasId={canvasId}
              cards={cards}
              lines={buildLines(model, cards, labelNames, liveMappings)}
              editable={editable}
              saveCard={updateCardAction.bind(null, ws)}
              placeCard={placeCardAction.bind(null, ws, canvasId)}
              placeCards={placeCardsAction.bind(null, ws, canvasId)}
              removeCard={removeCardAction.bind(null, ws)}
              removeCards={removeCardsAction.bind(null, ws, canvasId)}
              frames={frames}
              concepts={conceptsOf(model)}
              frameWrites={{
                moveOnCanvas: moveOnCanvasAction.bind(null, ws, canvasId),
                createFrame: createFrameAction.bind(null, ws, canvasId),
                updateFrame: updateFrameAction.bind(null, ws),
                resizeFrame: resizeFrameAction.bind(null, ws),
                fitFrame: fitFrameAction.bind(null, ws),
                deleteFrame: deleteFrameAction.bind(null, ws),
                putInNewFrame: putInNewFrameAction.bind(null, ws, canvasId),
                arrangeIntoFrames: arrangeIntoFramesAction.bind(null, ws, canvasId),
                setFrameCollapsed: setFrameCollapsedAction.bind(null, ws),
                setAllFramesCollapsed: setAllFramesCollapsedAction.bind(null, ws, canvasId),
              }}
              entityConcepts={Object.fromEntries(model.entities.map((e) => [e.id, e.concept_id]))}
              focusCardId={focusCardId}
              focusLabelId={focusLabelId}
              focusRequirementId={focusRequirementId}
              focusNoteId={focusNoteId}
              notes={notes}
              readAt={readAt}
              canNote={canNote}
              userName={shell.user.name}
              noteWrites={{
                createNote: createNoteAction.bind(null, ws, canvasId),
                updateNote: updateNoteAction.bind(null, ws),
                moveNote: moveNoteAction.bind(null, ws),
                pinNote: pinNoteAction.bind(null, ws),
                unpinNote: unpinNoteAction.bind(null, ws),
                deleteNote: deleteNoteAction.bind(null, ws),
                moveNotes: moveNotesAction.bind(null, ws, canvasId),
              }}
              diagnosis={diag.length ? { noLines: diag.includes("nolines"), blocks: diag.includes("blocks"), noFrames: diag.includes("noframes"), noLabels: diag.includes("nolabels"), collapsed: diag.includes("collapsed") } : undefined}
              live={
                liveLabel
                  ? {
                      labelId: liveLabel.id,
                      labelName: liveLabel.name,
                      names: Object.fromEntries([...model.entities, ...model.sourceTables].map((r) => [r.id, r.name])),
                      labelElement: labelForLiveCanvasAction.bind(null, ws, liveLabel.id),
                      removeCard: removeFromLiveCanvasAction.bind(null, ws),
                      notices: liveNoticesFor(shell.user.id, canvasId),
                    }
                  : null
              }
            />
          </AppShell>
          </WorkingContextProvider>
        </UndoProvider>
      </PanelsProvider>
      </CanvasLookProvider>
    </CanvasProvider>
  );
}

const CanvasTools = ({ editable, canNote }: { editable: boolean; canNote: boolean }) => (
  <>
    <LayerSwitch />
    {editable && <EntityToolButton />}
    {editable && <FrameToolButton />}
    {canNote && <NoteToolButton />}
    <HandToolButton />
    <NotationSwitch />
    <WorkingContextButton />
    <UndoButtons />
    <ZoomControls />
  </>
);
