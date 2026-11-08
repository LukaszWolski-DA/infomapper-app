// What the modules give InfoMapper's pages (slice 15a, AD-33, E6, E7, E13, E18): read once per page on the server and
// handed down as plain data and server actions (`src/ui/modules.ts`). Without module rows, and with InfoCube off,
// nothing is read beyond the workspace's switch.

import { getDataStore, type DataStore } from "@/data";
import { STORE_SCHEMA } from "./tables";
import type { Uuid } from "@/domain/ids";
import type { ChangeEvent, Workspace, WorkspaceModel } from "@/domain/types";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import { NO_MODULES, type DependentRow, type EntityCreate, type ModuleView } from "@/ui/modules";
import type { CardData } from "@/canvas/card-data";
import type { ModuleLineData } from "@/canvas/line-data";
import { cubeLines } from "@/modules/infocube/canvas/lines";
import { BUS_MATRIX_TEXTS } from "@/modules/infocube/domain/bus-matrix";
import { cubeIndex } from "@/modules/infocube/domain/keys";
import { CUBE_MAPPING_LOG, cubeRequirementFeeds, mappingIndex, relationshipDeletes } from "@/modules/infocube/domain/mappings";
import type { AttributeFeeds } from "@/domain/model/requirements";
import type { CheckInput, ModuleChecks } from "@/domain/model/checks";
import { cubeModuleChecks } from "./checks";
import type { CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";
import {
  attributeDeletes,
  cubePageRows,
  cubeRowFeeds,
  cubeSections,
  cubeTitle,
  entityDependents,
  FED_COVERAGE,
  FEED_WORDS,
  measureMarks,
  roleTitle,
  rolesOf,
  typeContext,
  type CubePageRows,
} from "@/modules/infocube/domain/view";

/** The creates' server actions, by key: `src/compose/actions.ts` for pages (server actions stay out of this file). */
export type CreateActions = Record<"fact" | "dimension", EntityCreate["action"]>;

const creates = (actions: CreateActions): EntityCreate[] => [
  { key: "fact", button: "New fact", here: "New fact here", testId: "button-new-fact", action: actions.fact },
  { key: "dimension", button: "New dimension", here: "New dimension here", testId: "button-new-dimension", action: actions.dimension },
];

/**
 * The modules' part of a canvas page: the roles on cards and in panels, the Cube tab and its creates (only while on).
 * `events`: the workspace's change events when four-eyes is on (slice 15c, O9), for each dimensional mapping's last
 * content editor (the panel says beforehand who may not approve; the server checks again).
 */
export async function moduleView(store: DataStore, workspace: Workspace, model: WorkspaceModel, actions: CreateActions, events: readonly ChangeEvent[] = []): Promise<ModuleView> {
  const hasDimensional = model.entities.some((e) => e.model_level === "dimensional");
  if (!workspace.infocube && !hasDimensional) return NO_MODULES;
  const [cube, measures, keys, cubeMappings, cubeMappingInputs] = hasDimensional
    ? await Promise.all([
        store.modules.list(workspace.id, "cube_entity"),
        store.modules.list(workspace.id, "cube_measure"),
        store.modules.list(workspace.id, "cube_key"),
        store.modules.list(workspace.id, "cube_mapping"),
        store.modules.list(workspace.id, "cube_mapping_input"),
      ])
    : [[], [], [], [], []];
  const roles: ModuleView["roles"] = {};
  // slice 19 (D-74): the chip names the type, factless, aggregate, junk, snapshot and outrigger; its title the long text
  const types = typeContext(cube, model.relationships, model.entities);
  for (const [entityId, c] of rolesOf(cube)) roles[entityId] = { text: cubeTitle(c, types).short, title: roleTitle(c, types), card: `dimn ${c.role}`, mark: "cube", coverage: FED_COVERAGE, feed: FEED_WORDS };
  // slice 15c: a dimensional row's feeds on cards (C12)
  const mappings = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs });
  // slice 15b: the Σ marks, an attribute's delete with InfoCube's rows (R4) and the rows of the panels' sections
  const index = cubeIndex({ entities: model.entities, attributes: model.attributes, relationships: model.relationships, cubeEntities: cube, cubeMeasures: measures, cubeKeys: keys });
  const described = {
    rowMarks: measureMarks(index, model.attributes),
    attributeDeletes: attributeDeletes(index, model.attributes, mappings),
    // slice 18 (F14): a relationship with lookups through it asks a second click
    relationshipDeletes: hasDimensional ? relationshipDeletes(mappings, cubeMappings) : {},
    rowFeeds: hasDimensional ? cubeRowFeeds(mappings, model.attributes) : {},
    data: hasDimensional
      ? {
          infocube: {
            ...cubePageRows(cube, measures, keys, cubeMappings, cubeMappingInputs),
            contentAuthors: workspace.four_eyes ? contentAuthorsOf(cubeMappings, events) : {},
          },
        }
      : {},
  };
  if (!workspace.infocube) return { ...NO_MODULES, roles, ...described };
  const sections = cubeSections(model.entities, cube, model.relationships).map(({ role, entities }) => ({
    key: `cube:${role}`,
    title: role === "fact" ? "Facts" : "Dimensions",
    mark: "cube",
    empty: role === "fact" ? "No facts yet." : "No dimensions yet.",
    emptyCreate: role === "fact" ? " Use New fact above." : " Use New dimension above.",
    entities,
  }));
  return {
    roles,
    ...described,
    tabs: [
      {
        id: "cube",
        name: "Cube",
        title: "InfoCube: facts and dimensions",
        sections,
        creates: ["fact", "dimension"],
        // slice 15d (B-8): the bus matrix, for every role
        actions: [{ key: "bus-matrix", label: BUS_MATRIX_TEXTS.button, title: BUS_MATRIX_TEXTS.buttonTitle, testId: "button-bus-matrix" }],
      },
    ],
    creates: creates(actions),
  };
}

/**
 * The modules' lines on a canvas (slice 15c, C7): InfoCube's dimensional mappings between the cards on it, from the
 * page's rows (`ModuleView.data`); none without them.
 */
export function moduleLines(view: ModuleView, model: WorkspaceModel, cards: readonly Pick<CardData, "id" | "kind" | "targetId">[]): ModuleLineData[] {
  const rows = view.data.infocube as CubePageRows | undefined;
  if (!rows?.cubeMappings.length) return [];
  // the page's rows come without `created_*` (O8): the lines read none of them
  return cubeLines(model, { cubeMappings: rows.cubeMappings as CubeMapping[], cubeMappingInputs: rows.cubeMappingInputs as CubeMappingInput[] }, cards);
}

/**
 * What a module feeds, for pages and actions that read the store themselves (slice 15c, C12; slice 15d, D4): the rows it
 * counts on cards, for the homes' thumbnails (as `ModuleView.rowFeeds`), and the requirement feeds (as
 * `requirementFeeds` on a canvas page). Nothing is read while the model has no fact or dimension. The homes read
 * InfoMapper's tables through the default store, which does not know a module's: this read takes the composed store
 * unless given one.
 */
export async function moduleFeeds(
  workspaceId: Uuid,
  model: { entities: readonly WorkspaceModel["entities"][number][]; attributes: readonly WorkspaceModel["attributes"][number][] },
  store: DataStore = getDataStore(STORE_SCHEMA),
): Promise<{ rowFeeds: Record<Uuid, { n: number }>; feeds: AttributeFeeds }> {
  if (!model.entities.some((e) => e.model_level === "dimensional" && e.deleted_at === null)) return { rowFeeds: {}, feeds: {} };
  const [cubeMappings, cubeMappingInputs] = await Promise.all([store.modules.list(workspaceId, "cube_mapping"), store.modules.list(workspaceId, "cube_mapping_input")]);
  const index = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs });
  return { rowFeeds: cubeRowFeeds(index, model.attributes), feeds: cubeRequirementFeeds(index, model.attributes) };
}

/**
 * The project home's module data in one read (slice 20, F19): the rows a module counts on cards (the thumbnails), the
 * requirement feeds, and its model checks for an input built with those feeds (`checks`). Nothing is read while the
 * model has no fact or dimension; InfoCube's checks are present while it is on in the workspace (`workspace.infocube`).
 */
export async function moduleHomeData(
  workspace: Pick<Workspace, "id" | "infocube">,
  model: { entities: readonly WorkspaceModel["entities"][number][]; attributes: readonly WorkspaceModel["attributes"][number][] },
  store: DataStore = getDataStore(STORE_SCHEMA),
): Promise<{ rowFeeds: Record<Uuid, { n: number }>; feeds: AttributeFeeds; checks: (input: CheckInput) => ModuleChecks[] }> {
  const on = !!workspace.infocube;
  if (!model.entities.some((e) => e.model_level === "dimensional" && e.deleted_at === null)) return { rowFeeds: {}, feeds: {}, checks: (input) => cubeModuleChecks(on, null, input) };
  const [cubeEntities, cubeMeasures, cubeKeys, cubeMappings, cubeMappingInputs] = await Promise.all([
    store.modules.list(workspace.id, "cube_entity"),
    store.modules.list(workspace.id, "cube_measure"),
    store.modules.list(workspace.id, "cube_key"),
    store.modules.list(workspace.id, "cube_mapping"),
    store.modules.list(workspace.id, "cube_mapping_input"),
  ]);
  const index = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs });
  const rows = cubePageRows(cubeEntities, cubeMeasures, cubeKeys, cubeMappings, cubeMappingInputs);
  return { rowFeeds: cubeRowFeeds(index, model.attributes), feeds: cubeRequirementFeeds(index, model.attributes), checks: (input) => cubeModuleChecks(on, rows, input) };
}

/** Each live dimensional mapping's last content editor (four-eyes, O9), by mapping id. */
function contentAuthorsOf(mappings: readonly CubeMapping[], events: readonly ChangeEvent[]): Record<Uuid, Uuid> {
  return Object.fromEntries(mappings.filter((m) => m.deleted_at === null).map((m) => [m.id, lastContentEditor(m, events, CUBE_MAPPING_LOG)]));
}

/**
 * The modules' rows in an entity's delete preview (X-1, X-4; slice 15c X-2): a fact's or a dimension's own rows and its
 * dimensional mappings; a logical entity's dimensional mappings and the facts and dimensions that lose their feed.
 * Nothing is read while the model has no fact or dimension.
 */
export async function moduleEntityDependents(store: DataStore, workspaceId: Uuid, entityId: Uuid, model: WorkspaceModel): Promise<DependentRow[]> {
  if (!model.entities.some((e) => e.model_level === "dimensional" && e.deleted_at === null)) return [];
  const [cube, measures, cubeMappings, cubeMappingInputs] = await Promise.all([
    store.modules.list(workspaceId, "cube_entity"),
    store.modules.list(workspaceId, "cube_measure"),
    store.modules.list(workspaceId, "cube_mapping"),
    store.modules.list(workspaceId, "cube_mapping_input"),
  ]);
  const mappings = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs });
  return entityDependents(entityId, model, cube, measures, mappings, cubeMappings);
}

/** The rows a module counts on cards, for the thumbnails (slice 15c): `moduleFeeds`' `rowFeeds`. */
export const moduleRowFeeds = async (workspaceId: Uuid, model: WorkspaceModel, store?: DataStore): Promise<Record<Uuid, { n: number }>> =>
  (await moduleFeeds(workspaceId, model, store)).rowFeeds;
