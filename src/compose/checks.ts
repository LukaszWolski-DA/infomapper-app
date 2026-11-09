// The modules' model checks (slice 20, the extension point; acceptance doc, "The extension point and the index"): each
// module's groups for InfoMapper's `modelChecks`, which never names a module. Pure and without the data layer, so a
// canvas page builds them from its own module rows (`ModuleView.data`); the home reads the rows with `moduleHomeData`
// (`view.ts`), in the one read it makes for coverage too. While a module is off it adds nothing.

import { checkIndex, modelChecks, type CheckIndex, type CheckInput, type CheckModel, type ModuleChecks } from "@/domain/model/checks";
import type { ModelLookup } from "@/domain/model/requirements";
import type { WorkspaceModel } from "@/domain/types";
import type { ModuleView } from "@/ui/modules";
import { CHECK_MAPPING_KIND, CUBE_MAPPING_GONE, cubeChecks, NO_CHECK_ROWS, type CubeCheckRows } from "@/modules/infocube/domain/checks";
import { cubeIndex, type CubeIndex } from "@/modules/infocube/domain/keys";
import type { CubeEntity, CubeKey, CubeMeasure } from "@/modules/infocube/domain/types";

/** InfoCube's checks from its rows, or none while it is off in the workspace; `index`: the caller's cube index, when it has one. */
export function cubeModuleChecks(on: boolean, rows: CubeCheckRows | null | undefined, input: CheckInput, index?: CubeIndex): ModuleChecks[] {
  return on ? [cubeChecks(rows ?? NO_CHECK_ROWS, input, index)] : [];
}

/** A canvas page's module checks, from the page's module rows: InfoCube's while its Cube tab is there (it is on). */
export function pageModuleChecks(view: ModuleView, input: CheckInput, index?: CubeIndex): ModuleChecks[] {
  return cubeModuleChecks(
    view.tabs.some((t) => t.id === "cube"),
    view.data.infocube as CubeCheckRows | undefined,
    input,
    index,
  );
}

/**
 * A canvas page's check index (slice 20, Łukasz's step 2 decisions): the whole model's checks from what the page has (the
 * model, its module rows, the requirement index's lookup), built once per data version in the browser. InfoCube's rules
 * get one cube index, built here from the page's rows.
 */
export function pageCheckIndex(view: ModuleView, model: CheckModel & Pick<WorkspaceModel, "relationships">, lookup: ModelLookup): CheckIndex {
  const input: CheckInput = { model, lookup, scope: null };
  const rows = view.data.infocube as CubeCheckRows | undefined;
  const cube = rows && view.tabs.some((t) => t.id === "cube")
    ? cubeIndex({ entities: model.entities, attributes: model.attributes, relationships: model.relationships, cubeEntities: rows.cubeEntities as CubeEntity[], cubeMeasures: rows.cubeMeasures as CubeMeasure[], cubeKeys: rows.cubeKeys as CubeKey[] })
    : undefined;
  return checkIndex(modelChecks(input, pageModuleChecks(view, input, cube)), (id) => lookup.attribute.get(id)?.entity_id);
}

/**
 * The entities a module's object stands between, for an arrival address (`?ext={kind}:{id}`, slice 20, F17): a
 * dimensional mapping's target's entity, then its inputs' entities; null when the page's rows have no such object (gone).
 */
export function extEntities(view: ModuleView, model: Pick<WorkspaceModel, "attributes">, kind: string, id: string): string[] | null {
  if (kind !== CHECK_MAPPING_KIND) return null;
  const rows = view.data.infocube as CubeCheckRows | undefined;
  const m = rows?.cubeMappings.find((x) => x.id === id && x.deleted_at === null);
  if (!m) return null;
  const entityOf = (attributeId: string) => model.attributes.find((a) => a.id === attributeId)?.entity_id;
  const inputs = rows!.cubeMappingInputs.filter((i) => i.mapping_id === id && i.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order);
  return [...new Set([entityOf(m.attribute_id), ...inputs.map((i) => entityOf(i.attribute_id))].filter((e): e is string => !!e))];
}

/** What a module says when its object named by an arrival address is gone; null for a kind no module has. */
export const extGoneText = (kind: string): string | null => (kind === CHECK_MAPPING_KIND ? CUBE_MAPPING_GONE : null);
