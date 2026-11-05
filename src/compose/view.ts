// What the modules give InfoMapper's pages (slice 15a, AD-33, E6, E7, E13, E18): read once per page on the server and
// handed down as plain data and server actions (`src/ui/modules.ts`). Without module rows, and with InfoCube off,
// nothing is read beyond the workspace's switch.

import type { DataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { Workspace, WorkspaceModel } from "@/domain/types";
import { NO_MODULES, type DependentRow, type EntityCreate, type ModuleView } from "@/ui/modules";
import { cubeIndex } from "@/modules/infocube/domain/keys";
import { attributeDeletes, cubePageRows, cubeSections, entityDependents, measureMarks, ROLE_NAMES, ROLE_TITLES, rolesOf } from "@/modules/infocube/domain/view";

/** The creates' server actions, by key: `src/compose/actions.ts` for pages (server actions stay out of this file). */
export type CreateActions = Record<"fact" | "dimension", EntityCreate["action"]>;

const creates = (actions: CreateActions): EntityCreate[] => [
  { key: "fact", button: "New fact", here: "New fact here", testId: "button-new-fact", action: actions.fact },
  { key: "dimension", button: "New dimension", here: "New dimension here", testId: "button-new-dimension", action: actions.dimension },
];

/** The modules' part of a canvas page: the roles on cards and in panels, the Cube tab and its creates (only while on). */
export async function moduleView(store: DataStore, workspace: Workspace, model: WorkspaceModel, actions: CreateActions): Promise<ModuleView> {
  const hasDimensional = model.entities.some((e) => e.model_level === "dimensional");
  if (!workspace.infocube && !hasDimensional) return NO_MODULES;
  const [cube, measures, keys] = hasDimensional
    ? await Promise.all([store.modules.list(workspace.id, "cube_entity"), store.modules.list(workspace.id, "cube_measure"), store.modules.list(workspace.id, "cube_key")])
    : [[], [], []];
  const roles: ModuleView["roles"] = {};
  for (const [entityId, c] of rolesOf(cube)) roles[entityId] = { text: ROLE_NAMES[c.role], title: ROLE_TITLES[c.role], card: `dimn ${c.role}`, mark: "cube" };
  // slice 15b: the Σ marks, an attribute's delete with InfoCube's rows (R4) and the rows of the panels' sections
  const index = cubeIndex({ entities: model.entities, attributes: model.attributes, relationships: model.relationships, cubeEntities: cube, cubeMeasures: measures, cubeKeys: keys });
  const described = {
    rowMarks: measureMarks(index, model.attributes),
    attributeDeletes: attributeDeletes(index, model.attributes),
    data: hasDimensional ? { infocube: cubePageRows(cube, measures, keys) } : {},
  };
  if (!workspace.infocube) return { ...NO_MODULES, roles, ...described };
  const sections = cubeSections(model.entities, cube).map(({ role, entities }) => ({
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
    tabs: [{ id: "cube", name: "Cube", title: "InfoCube: facts and dimensions", sections, creates: ["fact", "dimension"] }],
    creates: creates(actions),
  };
}

/** The modules' rows in an entity's delete preview (X-1, X-4). */
export async function moduleEntityDependents(store: DataStore, workspaceId: Uuid, entityId: Uuid, model: WorkspaceModel): Promise<DependentRow[]> {
  if (!model.entities.some((e) => e.id === entityId && e.model_level === "dimensional")) return [];
  const [cube, measures] = await Promise.all([store.modules.list(workspaceId, "cube_entity"), store.modules.list(workspaceId, "cube_measure")]);
  return entityDependents(entityId, model, cube, measures);
}
