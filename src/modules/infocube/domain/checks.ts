// InfoCube's model checks (slice 20, PRD R4 and R5; prototype `modelChecks`' C4 and C5): every fact's hints gathered
// ("Facts to check"), and the logical model under approved dimensional mappings (InfoCube's principle 4: the LDM is its
// upstream), computed from the model as it stands (decision 4a): a type conflict by the app's rule (High) and inputs
// not covered by D-31's rule (Normal). InfoMapper reads them through the composition root (`ModuleChecks`) and never
// names InfoCube; the texts are the module's.

import type { Uuid } from "@/domain/ids";
import { coverageGapText, type CheckGroup, type CheckInput, type CheckLine, type CheckRef, type ModuleChecks } from "@/domain/model/checks";
import { cubeIndex, factHints, typeWord, type CubeIndex, type Hint } from "./keys";
import { typesDiffer } from "./mappings";
import type { CubeEntity, CubeKey, CubeMapping, CubeMappingInput, CubeMeasure } from "./types";

/** A dimensional mapping's selection kind on the canvas (`CUBE_MAPPING_KIND` in `../canvas/lines.ts`; the test keeps them equal). */
export const CHECK_MAPPING_KIND = "cube_mapping";

/** InfoCube's rows as a page or the home reads them (the page's come without `created_*` and `updated_*`). */
export interface CubeCheckRows {
  cubeEntities: readonly Omit<CubeEntity, "created_at" | "created_by" | "updated_at" | "updated_by">[];
  cubeMeasures: readonly Omit<CubeMeasure, "created_at" | "created_by" | "updated_at" | "updated_by">[];
  cubeKeys: readonly Omit<CubeKey, "created_at" | "created_by" | "updated_at" | "updated_by">[];
  cubeMappings: readonly Omit<CubeMapping, "created_at" | "created_by" | "updated_at" | "updated_by">[];
  cubeMappingInputs: readonly Omit<CubeMappingInput, "created_at" | "created_by" | "updated_at" | "updated_by">[];
}

export const NO_CHECK_ROWS: CubeCheckRows = { cubeEntities: [], cubeMeasures: [], cubeKeys: [], cubeMappings: [], cubeMappingInputs: [] };

export const CUBE_CHECK_TEXTS = {
  tag: "InfoCube",
  topic: "InfoCube",
  allWell: "so do facts and their feeds",
  facts: { title: "Facts to check", short: "fact hint", hint: "The hints from each fact's panel, for the whole project." },
  feeds: {
    title: "Approved feeds broken by the logical model",
    short: "type conflict",
    hint: "The type of a logical attribute no longer fits an approved dimensional mapping that reads it. Fix the logical side, or set the mapping back to In review.",
  },
  under: {
    title: "Approved feeds over logical attributes not yet covered",
    short: "input not covered",
    hint: "The dimensional mapping is approved, but what it reads has no approved source mapping, so it covers no requirement yet.",
  },
  typeConflict: (input: string, inputType: string, target: string, targetType: string) => `type conflict: ${input} is ${inputType}, ${target} is ${targetType}`,
} as const;

/**
 * InfoCube's three groups (facts, feeds, under) for the input's scope; empty groups included. They read the indexes the
 * page has already (step 2's bench): the requirement index's lookup (its feeds are the dimensional mappings, with their
 * approval, type conflict and inputs) and the cube index (the facts' hints), which a caller that has one passes in.
 */
export function cubeChecks(rows: CubeCheckRows, { model, lookup, scope }: CheckInput, index?: CubeIndex): ModuleChecks {
  const entities = model.entities.filter((e) => e.deleted_at === null);
  const inScope = (id: Uuid | undefined) => !!id && (!scope || scope.has(id));
  const cube =
    index ??
    cubeIndex({
      entities,
      attributes: model.attributes,
      relationships: model.relationships,
      cubeEntities: rows.cubeEntities as CubeEntity[],
      cubeMeasures: rows.cubeMeasures as CubeMeasure[],
      cubeKeys: rows.cubeKeys as CubeKey[],
    });
  const name = new Map(entities.map((e) => [e.id, e.name]));
  const label = (attributeId: Uuid) => {
    const a = lookup.attribute.get(attributeId);
    return `${(a && name.get(a.entity_id)) ?? "?"}.${a?.name ?? "?"}`;
  };

  // every fact's hints, in the model's order of entities
  const facts: CheckLine[] = [];
  for (const e of entities) {
    if (cube.roleOf(e.id) !== "fact" || !inScope(e.id)) continue;
    for (const h of factHints(cube, e.id)) {
      const go = hintTarget(h, e.id);
      facts.push({
        go,
        name: e.name,
        detail: h.text,
        panels: [],
        marks: [h.go.t === "attribute" ? { t: "attribute", id: h.go.id } : { t: "entity", id: e.id }],
        entities: [...new Set([e.id, ...entitiesOf(go)])],
        hintOf: e.id,
      });
    }
  }

  // approved dimensional mappings: the lookup's feeds, by their targets in the model's order (entities, then attributes)
  const feeds: CheckLine[] = [];
  const under: CheckLine[] = [];
  for (const e of entities) {
    if (e.model_level !== "dimensional") continue;
    for (const target of lookup.attributesOf.get(e.id) ?? []) {
      for (const f of lookup.feedsOf(target.id)) {
        if (!f.approved) continue;
        const inputEntities = f.inputs.map((id) => lookup.attribute.get(id)?.entity_id).filter((id): id is Uuid => !!id);
        if (!inScope(e.id) && !inputEntities.some(inScope)) continue;
        const ref: CheckRef = { t: "ext", kind: CHECK_MAPPING_KIND, id: f.id };
        const line = `${f.inputs.map(label).join(" + ")} → ${label(target.id)}`;
        const named = [...new Set([e.id, ...inputEntities])];
        if (f.typeConflict) {
          const differ = f.inputs.map((id) => ({ id, types: typesDiffer(lookup.attribute.get(id), target) })).find((x) => x.types);
          feeds.push({
            go: ref,
            name: line,
            detail: differ ? CUBE_CHECK_TEXTS.typeConflict(label(differ.id), differ.types![0], label(target.id), differ.types![1]) : CUBE_CHECK_TEXTS.typeConflict("?", "?", label(target.id), typeWord(target)),
            panels: [ref, { t: "attribute", id: target.id }, ...f.inputs.map((id): CheckRef => ({ t: "attribute", id }))],
            marks: [{ t: "attribute", id: target.id }],
            entities: named,
          });
        }
        const gaps = f.inputs.map((id) => coverageGapText(lookup, id)).filter((t): t is string => !!t);
        if (gaps.length) under.push({ go: ref, name: line, detail: gaps.join("; "), panels: [ref], marks: [], entities: named });
      }
    }
  }

  const group = (id: "facts" | "feeds" | "under", lines: CheckLine[], high = false): CheckGroup => ({ id, ...CUBE_CHECK_TEXTS[id], high, module: CUBE_CHECK_TEXTS.tag, lines });
  return { topic: CUBE_CHECK_TEXTS.topic, allWell: CUBE_CHECK_TEXTS.allWell, groups: [group("feeds", feeds, true), group("facts", facts), group("under", under)] };

  function hintTarget(h: Hint, factId: Uuid): CheckRef {
    switch (h.go.t) {
      case "grain":
        return { t: "entity", id: factId };
      case "entity":
        return { t: "entity", id: h.go.id };
      case "relationship":
        return { t: "relationship", id: h.go.id };
      case "attribute":
        return { t: "attribute", id: h.go.id };
    }
  }
  function entitiesOf(ref: CheckRef): Uuid[] {
    if (ref.t === "entity") return [ref.id];
    if (ref.t === "attribute") return [cube.attribute(ref.id)?.entity_id].filter((id): id is Uuid => !!id);
    if (ref.t === "relationship") {
      const r = cube.relationship(ref.id);
      return r ? [r.from_entity_id, r.to_entity_id] : [];
    }
    return [];
  }
}
