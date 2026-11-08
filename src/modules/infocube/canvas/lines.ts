// InfoCube's lines on a canvas (slice 15c, C7; prototype `renderLines`' InfoCube part, l. 2130–2143): one dimensional
// mapping, from its logical inputs' rows to its dimensional target's row, in the target's concept colour, dashed while
// Draft (6 4) or In review (10 3 2 3), with a diamond at the target and ƒ on the first input for a transformation.
// InfoMapper's line layer draws them as a module's lines (`ModuleLineData`) and knows nothing of what they are. A line
// needs its target's card and at least one input's card on the canvas; inputs without a card are left out.

import type { CardData } from "@/canvas/card-data";
import type { ModuleLineData } from "@/canvas/line-data";
import type { Uuid } from "@/domain/ids";
import { NO_CONCEPT_COLOR } from "@/domain/model/concept-colors";
import type { WorkspaceModel } from "@/domain/types";
import { mappingIndex, type MappingModel } from "../domain/mappings";

/** The selection's kind of a dimensional mapping (`{ t: "ext", kind, id }`). */
export const CUBE_MAPPING_KIND = "cube_mapping";


export function cubeLines(
  model: Pick<WorkspaceModel, "concepts" | "entities" | "attributes">,
  rows: Pick<MappingModel, "cubeMappings" | "cubeMappingInputs">,
  cards: readonly Pick<CardData, "id" | "kind" | "targetId">[],
): ModuleLineData[] {
  const entityCard = new Map(cards.filter((c) => c.kind === "ent").map((c) => [c.targetId, c.id]));
  if (!entityCard.size || !rows.cubeMappings.length) return [];
  const index = mappingIndex({ entities: model.entities, attributes: model.attributes, ...rows });
  const colour = new Map(model.concepts.map((c) => [c.id, c.color]));
  const conceptOf = new Map(model.entities.map((e) => [e.id, e.concept_id]));
  const cardOf = (attributeId: Uuid) => {
    const a = index.attribute(attributeId);
    return a ? entityCard.get(a.entity_id) : undefined;
  };
  const lines: ModuleLineData[] = [];
  for (const m of rows.cubeMappings) {
    if (m.deleted_at !== null || !index.mapping(m.id)) continue;
    const targetCard = cardOf(m.attribute_id);
    if (!targetCard) continue;
    const inputs = index.inputsOf(m.id).flatMap((i) => {
      const cardId = cardOf(i.attribute_id);
      return cardId ? [{ rowId: i.attribute_id, cardId }] : [];
    });
    if (!inputs.length) continue;
    const entityId = index.attribute(m.attribute_id)!.entity_id;
    lines.push({
      kind: CUBE_MAPPING_KIND,
      id: m.id,
      inputs,
      target: { rowId: m.attribute_id, cardId: targetCard },
      cls: `cmap ${m.status}`,
      colour: colour.get(conceptOf.get(entityId) ?? "") ?? NO_CONCEPT_COLOR,
      endMark: "diamond",
      // slice 18: "L" on a lookup (prototype l. 2245); its relationship is in the panel, the line has no title (Q-C)
      ...(m.kind === "transform" ? { chip: "ƒ" } : m.kind === "lookup" ? { chip: "L" } : {}),
    });
  }
  return lines;
}
