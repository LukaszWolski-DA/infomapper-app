// What feeds the dimensional attributes, for InfoMapper's requirements (slice 15d, D3, D4, X-5): derived from the page's
// rows (`ModuleView.data`), so the page carries nothing new. Pure and without the data layer, so the browser's panels and
// canvas use it too; the server's homes read the same through `moduleFeeds` (`view.ts`).

import type { AttributeFeeds } from "@/domain/model/requirements";
import type { WorkspaceModel } from "@/domain/types";
import type { ModuleView } from "@/ui/modules";
import { cubeRequirementFeeds, fedFromConcepts, mappingIndex, type ConceptFeed } from "@/modules/infocube/domain/mappings";
import type { CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";
import type { CubePageRows } from "@/modules/infocube/domain/view";

export const NO_FEEDS: AttributeFeeds = {};

type FeedModel = Pick<WorkspaceModel, "entities" | "attributes">;

const indexOf = (view: ModuleView, model: FeedModel) => {
  const rows = view.data.infocube as CubePageRows | undefined;
  if (!rows?.cubeMappings.length) return null;
  // the page's rows come without `created_*` (O8); the index orders by id then
  return mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings: rows.cubeMappings as CubeMapping[], cubeMappingInputs: rows.cubeMappingInputs as CubeMappingInput[] });
};

/** The requirement feeds of a page's model; none without dimensional mappings. */
export function requirementFeeds(view: ModuleView, model: FeedModel): AttributeFeeds {
  const index = indexOf(view, model);
  return index ? cubeRequirementFeeds(index, model.attributes) : NO_FEEDS;
}

/** "Fed from concepts" of a fact or a dimension (D14), in the concepts' order; none without dimensional mappings. */
export function conceptFeeds(view: ModuleView, model: Pick<WorkspaceModel, "entities" | "attributes" | "concepts">, entityId: string): ConceptFeed[] {
  const index = indexOf(view, model);
  if (!index) return [];
  const conceptOf = new Map(model.entities.map((e) => [e.id, e.concept_id]));
  const order = [...model.concepts].filter((c) => c.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
  return fedFromConcepts(index, entityId, (id) => conceptOf.get(id), order);
}
