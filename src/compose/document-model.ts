// A document's model as its source says (slice 36, D-88 as proposed; step 1's Q1, Q3, Q8, F6): the live model, or a
// baseline's content read back as a snapshot (`snapshotOfContent`), never the live model in place of a baseline that is
// gone; the changes sections' comparisons made here, on the server (the older content never reaches the browser), each
// narrowed to the document's scope on either side; the canvases a document's figures are made from and checked against;
// and how many documents are made from each baseline. Through the composition root because the source is InfoMapper's
// (baselines) and the document InfoDocumenter's.

import type { DataStore } from "@/data/ports";
import { compareBaselines } from "@/domain/baseline/compare";
import { baselineContentOf, snapshotOfContent, type BaselineContent, type LiveParts } from "@/domain/baseline/content";
import type { BaselineRef, DocumentSource, SectionChanges } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable, Workspace } from "@/domain/types";
import { documentsFromBaseline } from "@/modules/infodocumenter/domain/commands";
import { diagramCanvases } from "@/modules/infodocumenter/domain/figures";
import { sectionScopeOf } from "@/modules/infodocumenter/domain/scope";
import { againstOf, changesInScope, changesKey, changesPlan, type ChangesSide } from "@/modules/infodocumenter/domain/sections-changes";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";
import { DOCUMENT_TABLES, documentStateFor } from "./documents";
import { BASELINE_MODULE_TABLES } from "./tables";

/** What a document is built from: its snapshot, its source, the workspace's live baselines and its comparisons. */
export interface DocumentModel {
  readonly snapshot: WorkspaceSnapshot<ModuleTable>;
  readonly source: DocumentSource;
  /** The live baselines, newest first, names and times only (the editor's "Model state" and "Compared with"). */
  readonly baselines: readonly BaselineRef[];
  /** By `changesKey` of each changes section's "Compared with". */
  readonly changes: Readonly<Record<string, SectionChanges>>;
}

type Doc = Pick<DocumentDefinition, "source_kind" | "baseline_id" | "scope" | "sections">;

const refOf = (b: BaselineRef): BaselineRef => ({ id: b.id, name: b.name, created_at: b.created_at });
/** The tables a live read needs for a document and for its "now" as a content (the same today, both asked). */
const LIVE_TABLES: readonly ModuleTable[] = [...new Set<ModuleTable>([...DOCUMENT_TABLES, ...BASELINE_MODULE_TABLES])];

/** The workspace's live baselines, newest first, as a document names them. */
export async function baselineRefs(store: DataStore, workspaceId: Uuid): Promise<BaselineRef[]> {
  return (await store.baselines.list(workspaceId)).map(refOf);
}

/** What a content does not hold, from the live workspace (Q1): its row, the organization, the people. */
async function liveParts(store: DataStore, workspace: Workspace): Promise<LiveParts<ModuleTable>> {
  const [organization, people] = await Promise.all([store.organizations.get(workspace.organization_id), store.users.listForWorkspace(workspace.id)]);
  return { workspace, organization, people };
}

/** An empty model (a document whose baseline is gone builds nothing from it, B3.5). */
function emptyContent(): BaselineContent {
  const none: never[] = [];
  return {
    settings: { dv2_mode: false, four_eyes: false, naming_conventions: null, infocube: false },
    model: {
      concepts: none,
      entities: none,
      attributes: none,
      relationships: none,
      sourceSystems: none,
      sourceTables: none,
      sourceColumns: none,
      mappings: none,
      mappingInputs: none,
      attributeInputs: none,
      sourceRelationships: none,
      sourceRelationshipColumns: none,
      classifications: none,
      classificationLinks: none,
      stereotypes: none,
      lostOriginals: none,
    },
    requirements: none,
    requirementLinks: none,
    projects: none,
    projectCanvases: none,
    canvasItems: none,
    canvases: none,
    frames: none,
    modules: {},
  };
}

/** One state of a comparison: its content and the snapshot the scope is resolved on. */
interface State {
  readonly content: BaselineContent;
  readonly snapshot: WorkspaceSnapshot<ModuleTable>;
}

/**
 * The document's model (Q1): for a live document one `store.snapshot` (its "now" content projected from the same read);
 * for a baseline's its content with the live parts; for a gone baseline an empty model and `gone`. Null when the
 * workspace is not live.
 */
export async function documentModel(store: DataStore, workspace: Workspace, doc: Doc): Promise<DocumentModel | null> {
  const baselines = await baselineRefs(store, workspace.id);
  let source: DocumentSource;
  let own: State;
  if (doc.source_kind === "live" || !doc.baseline_id) {
    const snapshot = await store.snapshot(workspace.id, LIVE_TABLES);
    if (!snapshot) return null;
    source = { kind: "live" };
    own = { content: baselineContentOf(snapshot, BASELINE_MODULE_TABLES), snapshot };
  } else {
    const baseline = baselines.find((b) => b.id === doc.baseline_id);
    const content = baseline ? await store.baselines.content(workspace.id, baseline.id) : null;
    const live = await liveParts(store, workspace);
    if (!baseline || !content) {
      return { snapshot: snapshotOfContent(emptyContent(), live, DOCUMENT_TABLES), source: { kind: "gone" }, baselines, changes: {} };
    }
    source = { kind: "baseline", ...baseline };
    own = { content, snapshot: snapshotOfContent(content, live, DOCUMENT_TABLES) };
  }
  const changes = await comparisons(store, workspace, doc, source, own, baselines);
  return { snapshot: own.snapshot, source, baselines, changes };
}

/**
 * The comparisons of the document's changes sections that are on, by `changesKey` (Q3): each plan's two contents read
 * once, compared (`compareBaselines`), then narrowed to the document's scope on either side (`changesInScope`). A live
 * document's "now" is the state the rest of the document shows (`own`).
 */
async function comparisons(store: DataStore, workspace: Workspace, doc: Doc, source: DocumentSource, own: State, baselines: readonly BaselineRef[]): Promise<Record<string, SectionChanges>> {
  const wanted = [...new Set(doc.sections.filter((s) => s.type === "changes" && s.on).map((s) => againstOf(s.options)))];
  const out: Record<string, SectionChanges> = {};
  if (!wanted.length || source.kind === "gone") return out;
  const sourceRef = source.kind === "baseline" ? refOf(source) : null;
  const states = new Map<string, Promise<State | null>>();
  let live: Promise<LiveParts<ModuleTable>> | null = null;
  const stateOf = (b: BaselineRef | null): Promise<State | null> => {
    if (b === null || b.id === sourceRef?.id) return Promise.resolve(own);
    if (!states.has(b.id))
      states.set(
        b.id,
        (async () => {
          const content = await store.baselines.content(workspace.id, b.id);
          if (!content) return null;
          live ??= liveParts(store, workspace);
          return { content, snapshot: snapshotOfContent(content, await live, DOCUMENT_TABLES) };
        })(),
      );
    return states.get(b.id)!;
  };
  for (const against of wanted) {
    const plan = changesPlan(sourceRef, against, baselines);
    if (plan.kind !== "compare") {
      out[changesKey(against)] = plan;
      continue;
    }
    const [older, newer] = await Promise.all([stateOf(plan.older), stateOf(plan.newer)]);
    if (!older || !newer) {
      out[changesKey(against)] = { kind: "gone" };
      continue;
    }
    const side = (s: State, baseline: BaselineRef | null): ChangesSide => {
      const state = documentStateFor(s.snapshot, { source: baseline ? { kind: "baseline", ...baseline } : { kind: "live" } });
      return { state, scope: sectionScopeOf(doc.scope, s.snapshot) };
    };
    const changes = changesInScope(compareBaselines(older.content, newer.content), doc.scope, [side(older, plan.older), side(newer, plan.newer)]);
    out[changesKey(against)] = { kind: "list", older: refOf(plan.older), newer: plan.newer ? refOf(plan.newer) : null, changes };
  }
  return out;
}

/** The comparisons alone (the editor's re-ask after a saved change): the same as `documentModel`'s. */
export async function documentChanges(store: DataStore, workspace: Workspace, doc: Doc): Promise<Record<string, SectionChanges> | null> {
  return (await documentModel(store, workspace, doc))?.changes ?? null;
}

/**
 * The canvases a document's figures are made from and checked against (F6): the source's (a baseline's content, or
 * the live model's), in Diagrams' order for `chosen` projects (`diagramCanvases`), label canvases left out of a
 * baseline's (they are not drawn from one, F5); and every canvas with its frames for the figure save's check.
 */
export async function documentCanvases(
  store: DataStore,
  workspaceId: Uuid,
  source: { readonly baselineId: Uuid | null },
  chosen: readonly Uuid[],
): Promise<{ order: Uuid[]; canvasIds: Set<string>; frameCanvas: Map<string, string> }> {
  if (source.baselineId) {
    const content = await store.baselines.content(workspaceId, source.baselineId);
    if (!content) return { order: [], canvasIds: new Set(), frameCanvas: new Map() };
    const drawn = content.canvases.filter((c) => !c.live_label_id);
    const order = diagramCanvases(content.projects, content.projectCanvases, chosen, chosen.length ? [] : drawn).filter((id) => drawn.some((c) => c.id === id));
    return { order, canvasIds: new Set(content.canvases.map((c) => c.id)), frameCanvas: new Map(content.frames.map((f) => [f.id, f.canvas_id])) };
  }
  const [projects, canvases, frames] = await Promise.all([store.projects.list(workspaceId), store.canvases.list(workspaceId), store.frames.list(workspaceId)]);
  const links = (await Promise.all(projects.map((p) => store.canvases.listLinksOfProject(workspaceId, p.id)))).flat();
  // with no project chosen, the canvases in no project too (slice 27, step 4)
  return {
    order: diagramCanvases(projects, links, chosen, chosen.length ? [] : canvases),
    canvasIds: new Set(canvases.map((c) => c.id)),
    frameCanvas: new Map(frames.map((f) => [f.id, f.canvas_id])),
  };
}

/** How many live documents are made from each live baseline (Q8): numbers only, every author's documents counted. */
export async function baselineDocumentCounts(store: DataStore, workspaceId: Uuid): Promise<Record<string, number>> {
  const [baselines, docs] = await Promise.all([store.baselines.list(workspaceId), store.modules.list(workspaceId, "document_definition")]);
  return Object.fromEntries(baselines.map((b) => [b.id, documentsFromBaseline(docs, b.id)]));
}
