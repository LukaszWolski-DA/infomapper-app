import { placeCardAction, placeCardsAction, placeRequirementCardsAction, removeCardAction, removeCardsAction, updateCardAction } from "@/app/_actions/canvas-item";
import {
  arrangeIntoFramesAction,
  createFrameAction,
  deleteFrameAction,
  fitFrameAction,
  moveOnCanvasAction,
  putInNewFrameAction,
  resetCanvasViewAction,
  setCanvasNamesAction,
  resizeFrameAction,
  setAllFramesCollapsedAction,
  setFrameCollapsedAction,
  updateFrameAction,
} from "@/app/_actions/frame";
import { saveCanvasLookAction } from "@/app/_actions/canvas";
import { linkRequirementAction } from "@/app/_actions/requirement";
import { labelForLiveCanvasAction, removeFromLiveCanvasAction } from "@/app/_actions/live";
import { liveNoticesFor } from "@/app/_lib/live-notices";
import { createNoteAction, deleteNoteAction, moveNoteAction, moveNotesAction, pinNoteAction, unpinNoteAction, updateNoteAction } from "@/app/_actions/note";
import { AppShell } from "@/app/_components/app-shell";
import { MovedNotice } from "@/app/_components/moved-notice";
import { ViewStateBar } from "@/app/_components/view-state-bar";
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
import { systemImports } from "@/app/_panels/import/system-imports";
import { buildCards, type CardData } from "@/canvas/card-data";
import { buildRequirementCards } from "@/canvas/requirement-card-data";
import { buildFrames, conceptsOf } from "@/canvas/frame-data";
import { FrameToolButton } from "@/canvas/FrameToolButton";
import { buildLines, type Selection } from "@/canvas/line-data";
import { buildNotes } from "@/canvas/note-data";
import { NoteToolButton } from "@/canvas/NoteToolButton";
import { MoreTools } from "@/canvas/MoreTools";
import { MORE_FOCUS, MORE_NAMES, MORE_TOOLS } from "@/canvas/more-breakpoints";
import { CanvasProvider } from "@/canvas/CanvasProvider";
import { EntityToolButton } from "@/canvas/EntityToolButton";
import { HandToolButton } from "@/canvas/HandToolButton";
import { FocusButton } from "@/canvas/Focus";
import { ChangesButton } from "@/canvas/Changes";
import { changesImport } from "@/canvas/changes-import";
import { LayerSwitch } from "@/canvas/LayerSwitch";
import { NamesSwitch } from "@/canvas/NamesSwitch";
import { CanvasLookProvider } from "@/canvas/look";
import { ModelCanvas } from "@/canvas/ModelCanvas";
import { SelectionHistory } from "@/canvas/SelectionHistory";
import { CanvasThrowHook, TestHooks } from "@/canvas/TestHooks";
import { CanvasErrorBoundary } from "@/app/_components/canvas-error-boundary";
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
import type { WorkspaceModel } from "@/domain/types";
import { workspacePeople } from "@/app/_lib/people";

// Canvas page: tabs, the left panel (model and sources), the model canvas and the right panel (slice 1a); the Entity
// tool and Undo and Redo in the top bar (slice 1b); the Hand tool, a selection of several cards, the canvas's look and
// layer mode, and “On canvases” in the panels (slice 2a); frames and the Frame tool (slice 2b); working labels: their
// marks on the canvas, the Labels field and the label panel, notes on the canvas (slice 3a). `?card=entity:<id>` or `?card=source:<id>` selects that card
// and shows it on arrival, `?label=<id>` opens that label's panel, `?note=<id>` selects that note (the project home's open
// notes); `?map=`, `?row=` and `?system=` select a mapping, a row or a source system (model consistency, slice 7b);
// `?moved=1` says that the address you opened is no longer in this project.
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
  const [model, allItems, canvases, workspace, history, projects, frameRows, labels, labelLinks, noteRows, users, requirements, requirementLinks, imports, sourceChanges] = await Promise.all([
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
    workspacePeople(store, workspaceId),
    store.requirements.list(ws),
    store.requirements.listLinks(ws),
    store.model.listImports(ws),
    store.model.listChanges(ws),
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
  const cards = buildCards(model, items.filter((i) => i.canvas_id === canvasId), labelNames, liveLabel && membership
      ? {
          labelName: liveLabel.name,
          relevantRows: membership.relevantRows,
          removeOf: (target) => {
            const q = liveRemoveQuestion(liveLabel.id, target, { ...model, links: liveLinks });
            return { direct: !!q.direct, what: liveRemoveWhat(q, target.kind), others: q.viaRows.length + q.viaMappings.length };
          },
        }
      : null,
    sourceChanges,
    canvas,
  );
  // requirements (slice 4a): the index is built once per page here for the left panel; the panels build theirs once
  // per data version in the browser
  const requirementIndex = buildRequirementIndex(requirements, requirementLinks, model);
  // requirement cards (slice 4b-2): this canvas's cards with a requirement, drawn from the same index
  const requirementCards = buildRequirementCards(items.filter((i) => i.canvas_id === canvasId), requirementIndex);
  const tree = buildTree(model, items, canvasId, view.canvases.map((c) => c.id), requirementIndex, sourceChanges);
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
  // `?map=`, `?row=<attribute or column id>`, `?system=` (slice 7b, F15): the project home's model consistency
  const focusSelection = arrivalSelection(query, model, cards);

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
  // the import wizard (slice 7a): the same objects the inspector gets, so the payload carries them once, and when each
  // system was last imported (the list is newest first)
  const lastImports: Record<string, string> = {};
  for (const i of imports) lastImports[i.source_system_id] ??= i.created_at;
  // the Changes view's select (slice 7b, item 26): every import, newest first
  const systemName = new Map(model.sourceSystems.map((s) => [s.id, s.name]));
  const changeImports = systemImports(imports, userName).map((i) => changesImport(i.id, systemName.get(i.systemId) ?? "?", i.at, i.label));
  const importData = editable
    ? { model, requirements, requirementLinks, canvasesOf, canvasNames: Object.fromEntries(canvases.map((c) => [c.id, c.name])), lastImports, changes: sourceChanges, dataVault: !!workspace?.dv2_mode }
    : undefined;

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
              left: <LeftPanel workspaceId={ws} canvasId={canvasId} tree={tree} editable={editable} conceptFrames={conceptFrames} importData={importData} />,
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
                  imports={systemImports(imports, userName)}
                  importData={importData}
                  changes={sourceChanges}
                  people={Object.fromEntries(users.map((u) => [u.id, u.display_name]))}
                  dataVault={!!workspace?.dv2_mode}
                />
              ),
              openDetails: !!(focusCardId || focusLabelId || focusRequirementId || focusNoteId || focusSelection),
              // `?diag=noviewbar` (measurement build only, slice 6a S6A-09): the page without the bar, to time a switch alone
              viewState: diag.includes("noviewbar") ? undefined : <ViewStateBar editable={editable} live={liveLabel ? { labelName: liveLabel.name } : null} />,
              status: (
                <StatusBar
                  model={model}
                  entityIds={cards.filter((c) => c.kind === "ent").map((c) => c.targetId)}
                  requirements={requirementCounts}
                  openNotes={noteRows.filter((n) => n.deleted_at === null && n.status === "open").length}
                  sourceChanges={sourceChanges.filter((c) => c.deleted_at === null && c.status === "open").length}
                />
              ),
            }}
          >
            {query.moved === "1" && <MovedNotice project={view.project.name} canvas={canvas.name} />}
            <RememberLastCanvas projectId={projectId} canvasId={canvasId} />
            {/* selections as places in the browser's history (slice 6b) */}
            <SelectionHistory key={canvasId} canvasId={canvasId} labelIds={labels.filter((l) => l.deleted_at === null).map((l) => l.id)} />
            {/* the measuring hook (slice 4p): e2e dev server and measurement build only */}
            {areTestHooksOn() && <TestHooks indexData={{ model, requirements, requirementLinks }} />}
            {/* an error inside the canvas shows a message in its place; the panels and the top bar keep working (slice 4p) */}
            <CanvasErrorBoundary>
            <ModelCanvas
              key={canvasId}
              canvasId={canvasId}
              cards={cards}
              names={{ entity_names: canvas.entity_names, attribute_names: canvas.attribute_names, version: canvas.version }}
              lines={buildLines(model, cards, labelNames, liveMappings)}
              editable={editable}
              saveCard={updateCardAction.bind(null, ws)}
              placeCard={placeCardAction.bind(null, ws, canvasId)}
              placeCards={placeCardsAction.bind(null, ws, canvasId)}
              removeCard={removeCardAction.bind(null, ws)}
              removeCards={removeCardsAction.bind(null, ws, canvasId)}
              requirementCards={requirementCards}
              placeRequirementCards={placeRequirementCardsAction.bind(null, ws, canvasId)}
              linkRequirement={linkRequirementAction.bind(null, ws)}
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
                resetCanvasView: resetCanvasViewAction.bind(null, ws, canvasId),
                setCanvasNames: setCanvasNamesAction.bind(null, ws, canvasId),
              }}
              entityConcepts={Object.fromEntries(model.entities.map((e) => [e.id, e.concept_id]))}
              focusCardId={focusCardId}
              focusLabelId={focusLabelId}
              focusRequirementId={focusRequirementId}
              focusNoteId={focusNoteId}
              focusSelection={focusSelection}
              // fading (slice 4p): the same objects the inspector gets, so the page's payload carries them once
              fadeData={{ model, requirements, requirementLinks, changes: sourceChanges }}
              changeImports={changeImports}
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
            {areTestHooksOn() && <CanvasThrowHook />}
            </CanvasErrorBoundary>
          </AppShell>
          </WorkingContextProvider>
        </UndoProvider>
      </PanelsProvider>
      </CanvasLookProvider>
    </CanvasProvider>
  );
}

/** What `?map=`, `?row=` or `?system=` selects on arrival (slice 7b, F15); a row whose card is not here is its element. */
function arrivalSelection(query: Record<string, string | string[] | undefined>, model: WorkspaceModel, cards: readonly CardData[]): Selection | undefined {
  const { map, row, system } = query;
  if (typeof map === "string" && model.mappings.some((m) => m.id === map)) return { t: "map", id: map };
  if (typeof system === "string" && model.sourceSystems.some((s) => s.id === system)) return { t: "element", kind: "source_system", id: system };
  if (typeof row !== "string") return undefined;
  const attribute = model.attributes.find((a) => a.id === row);
  const column = attribute ? undefined : model.sourceColumns.find((c) => c.id === row);
  if (!attribute && !column) return undefined;
  const card = cards.find((c) => (attribute ? c.kind === "ent" && c.targetId === attribute.entity_id : c.kind === "src" && c.targetId === column!.source_table_id));
  return card ? { t: "row", cardId: card.id, id: row } : { t: "element", kind: attribute ? "attribute" : "source_column", id: row };
}

// On a narrow window the names' check boxes (slice 11), then Focus and the notation, then the four tools, leave the bar for “More” (slice 6a): each wrapper is
// the tool's own element in the bar (`display: contents` until its breakpoint).
const CanvasTools = ({ editable, canNote }: { editable: boolean; canNote: boolean }) => (
  <>
    <LayerSwitch />
    <span className={`contents ${MORE_NAMES.inBar}`}>
      <NamesSwitch />
    </span>
    <span className={`contents ${MORE_FOCUS.inBar}`}>
      <FocusButton />
      <ChangesButton />
    </span>
    <span className={`contents ${MORE_TOOLS.inBar}`}>
      {editable && <EntityToolButton />}
      {editable && <FrameToolButton />}
      {canNote && <NoteToolButton />}
      <HandToolButton />
    </span>
    <span className={`contents ${MORE_FOCUS.inBar}`}>
      <NotationSwitch />
    </span>
    <WorkingContextButton />
    <UndoButtons />
    <ZoomControls />
    <MoreTools editable={editable} canNote={canNote} />
  </>
);
