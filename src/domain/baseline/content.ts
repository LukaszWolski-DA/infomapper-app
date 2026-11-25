// What a baseline holds (slice 35, step 1's Q2, F1, F19): a projection of the one consistent read the store already has
// (`store.snapshot`, `WorkspaceSnapshot`), keeping its field names, so a baseline and the live model are read through the
// same rules. Taking a baseline and comparing with Now both go through `baselineContentOf`, so a baseline compared with
// Now right after it was taken shows no change.

import { isLogical } from "../model/levels";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { Write } from "../changes";
import type {
  Baseline,
  Canvas,
  CanvasItem,
  CoreTable,
  Frame,
  ModuleTable,
  Project,
  ProjectCanvas,
  Requirement,
  RequirementLink,
  WorkspaceModel,
} from "../types";

/** The workspace's settings a baseline keeps (the design): the rest of the workspace's row is not the model. */
export interface BaselineSettings {
  readonly dv2_mode: boolean;
  readonly four_eyes: boolean;
  readonly naming_conventions: string | null;
  readonly infocube: boolean;
}

/** A module's rows in a baseline, by table (only the tables flagged "in"). */
export type BaselineModuleRows = { readonly [table: string]: readonly Record<string, unknown>[] };

/**
 * A baseline's content at `SNAPSHOT_SCHEMA` (`upgrade.ts`): `WorkspaceSnapshot`'s fields without the working layer,
 * people and access. Rows as the store hands them on (every column, a module's defaults and upgrades applied), in the
 * snapshot's orders. The classification and stereotype lists keep their removed rows, as `model.load` does.
 */
export interface BaselineContent {
  readonly settings: BaselineSettings;
  readonly model: WorkspaceModel;
  readonly requirements: readonly Requirement[];
  readonly requirementLinks: readonly RequirementLink[];
  readonly projects: readonly Project[];
  readonly projectCanvases: readonly ProjectCanvas[];
  readonly canvasItems: readonly CanvasItem[];
  readonly canvases: readonly Canvas[];
  readonly frames: readonly Frame[];
  readonly modules: BaselineModuleRows;
}

/** The content's fields and the table each holds (the flags and the upgrade chain read it). */
export const CONTENT_TABLES = {
  model: {
    concepts: "concept",
    entities: "entity",
    attributes: "attribute",
    relationships: "relationship",
    sourceSystems: "source_system",
    sourceTables: "source_table",
    sourceColumns: "source_column",
    mappings: "mapping",
    mappingInputs: "mapping_input",
    attributeInputs: "attribute_input",
    sourceRelationships: "source_relationship",
    sourceRelationshipColumns: "source_relationship_column",
    classifications: "classification",
    classificationLinks: "classification_link",
    stereotypes: "stereotype",
  },
  requirements: "requirement",
  requirementLinks: "requirement_link",
  projects: "project",
  projectCanvases: "project_canvas",
  canvasItems: "canvas_item",
  canvases: "canvas",
  frames: "frame",
} as const satisfies { model: Record<Exclude<keyof WorkspaceModel, "lostOriginals">, CoreTable> } & Record<string, unknown>;

/** InfoMapper's tables the content holds, from `CONTENT_TABLES`. */
export const contentTables = (): CoreTable[] => {
  const { model, ...rest } = CONTENT_TABLES;
  return [...Object.values(model), ...Object.values(rest)] as CoreTable[];
};

/**
 * The content of a baseline taken from `snapshot`, which the store read with exactly the module tables flagged "in"
 * (`moduleTables`). A deep copy: nothing of the read is shared with what is stored.
 */
export function baselineContentOf<T extends ModuleTable>(snapshot: WorkspaceSnapshot<T>, moduleTables: readonly T[]): BaselineContent {
  const w = snapshot.workspace;
  const modules: Record<string, readonly Record<string, unknown>[]> = {};
  for (const table of moduleTables) modules[table] = (snapshot.modules[table] ?? []) as unknown as Record<string, unknown>[];
  return structuredClone({
    settings: { dv2_mode: w.dv2_mode, four_eyes: w.four_eyes, naming_conventions: w.naming_conventions, infocube: w.infocube },
    model: snapshot.model,
    requirements: snapshot.requirements,
    requirementLinks: snapshot.requirementLinks,
    projects: snapshot.projects,
    projectCanvases: snapshot.projectCanvases,
    canvasItems: snapshot.canvasItems,
    canvases: snapshot.canvases,
    frames: snapshot.frames,
    modules,
  });
}

/** What a document from a baseline takes from the live workspace (slice 36, Q1): what a content does not hold. */
export type LiveParts<T extends ModuleTable> = Pick<WorkspaceSnapshot<T>, "workspace" | "organization" | "people">;

/**
 * A baseline's content read back as a workspace snapshot (slice 36, Q1; the inverse of `baselineContentOf`), so a
 * document's builders read a baseline exactly as they read the live model. The model, requirements, projects, canvases,
 * their items and frames and the modules' rows are the content's; the workspace's row is today's (its name, client and
 * documentation language) with the content's four settings over it (Data Vault mode, four-eyes, naming conventions and
 * InfoCube then); the organization and the people are today's; labels, label links and members are empty (a content has
 * none: a label canvas is not drawn from a baseline). `moduleTables`: the module tables the reader asks for, each the
 * content's rows or none. Pure; nothing is copied.
 */
export function snapshotOfContent<T extends ModuleTable>(content: BaselineContent, live: LiveParts<T>, moduleTables: readonly T[]): WorkspaceSnapshot<T> {
  const modules = Object.fromEntries(moduleTables.map((t) => [t, content.modules[t] ?? []])) as unknown as WorkspaceSnapshot<T>["modules"];
  return {
    workspace: { ...live.workspace, ...content.settings },
    organization: live.organization,
    model: content.model,
    requirements: content.requirements,
    requirementLinks: content.requirementLinks,
    projects: content.projects,
    projectCanvases: content.projectCanvases,
    canvasItems: content.canvasItems,
    canvases: content.canvases,
    frames: content.frames,
    labels: [],
    labelLinks: [],
    members: [],
    people: live.people,
    modules,
  };
}

/** The list's summary (Łukasz's answer 2): logical entities, mappings (source to logical) and requirements, as the Overview. */
export function baselineSummary(content: BaselineContent): Pick<Baseline, "entity_count" | "mapping_count" | "requirement_count"> {
  return {
    entity_count: content.model.entities.filter(isLogical).length,
    mapping_count: content.model.mappings.length,
    requirement_count: content.requirements.length,
  };
}

/** The insert's row: the baseline with its content, which only this write carries (the store keeps it apart). */
export type BaselineInsert = Baseline & { snapshot: BaselineContent };

/**
 * The write rule both adapters check (step 1's F2): a baseline's content is written only by its insert; an update that
 * carries it is refused, so a rename or a delete never changes what a baseline holds.
 */
export function snapshotWriteRefusal(writes: readonly Write[]): string | null {
  for (const w of writes) {
    if (w.table === "baseline" && w.kind === "update" && "snapshot" in (w.row as object)) return "A baseline's content never changes.";
    if (w.table === "baseline" && w.kind === "insert" && !("snapshot" in (w.row as object))) return "A baseline is written with its content.";
  }
  return null;
}
