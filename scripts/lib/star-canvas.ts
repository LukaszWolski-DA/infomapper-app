// "Performance test – star" (slice 15c, C15, X7): a canvas of its own in the workspace "Performance test", with 40
// logical cards of the large model (all its logical entities but the one with 200 attributes: it has 41, step 1
// planned 50) and 50 generated facts and dimensions (20 facts, 30 dimensions, 8 attributes each),
// in columns that alternate logical and dimensional, joined either by 300 dimensional mappings (60 of them
// transformations with two inputs and ƒ) or by 300 relationships between the same cards (one per mapping, from its
// first input's entity to its target's). For the measurement only: the measuring spec writes it into the e2e data file,
// never into the seed or `.data/dev-db.json`.

import { readDb, writeDb } from "../../src/data/local/file";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { seedId } from "../../src/data/local/seed-model";
import { SEED_IDS } from "../../src/data/local/seed";
import type { Uuid } from "../../src/domain/ids";
import type { Attribute, Entity, Relationship } from "../../src/domain/types";
import type { CubeEntity, CubeMapping, CubeMappingInput } from "../../src/modules/infocube/domain/types";

export const STAR_CANVAS_ID = seedId(LARGE_IDS.workspace, "perf-star:canvas");
export const STAR_CANVAS_NAME = "Performance test – star";
/** The facts and dimensions; the logical cards are `STAR_LOGICAL`. */
export const STAR_CARDS = 50;
export const STAR_LOGICAL = 40;
export const STAR_LINES = 300;

/** Column and row of the n-th card of a level: logical cards in the even columns, facts and dimensions in the odd. */
const place = (n: number, level: "logical" | "dimensional") => ({ x: (2 * Math.floor(n / 10) + (level === "dimensional" ? 1 : 0)) * 330, y: (n % 10) * 290 });

/** Adds the canvas to a file that holds "Performance test"; `joined` picks the lines. False if it is there already. */
export async function addStarCanvas(file: string, joined: "mappings" | "relationships"): Promise<boolean> {
  const db = (await readDb(file)) as Awaited<ReturnType<typeof readDb>> & { cube_entity?: CubeEntity[]; cube_mapping?: CubeMapping[]; cube_mapping_input?: CubeMappingInput[] };
  if (db.canvas.some((c) => c.id === STAR_CANVAS_ID)) return false;
  const ws = LARGE_IDS.workspace;
  const at = new Date().toISOString();
  const by = SEED_IDS.userLukasz;
  const std = (key: string) => ({ id: seedId(ws, `perf-star:${key}`), workspace_id: ws, version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null });
  const from = db.canvas.find((c) => c.id === LARGE_IDS.canvas);
  if (!from) throw new Error(`${file} has no "Performance test" (npm run seed:large).`);

  // InfoCube on in the workspace (a file's flag: the switch's licence is the settings' concern)
  const workspace = db.workspace.find((w) => w.id === ws)!;
  (workspace as { infocube: boolean }).infocube = true;

  const live = <T extends { workspace_id: Uuid; deleted_at: string | null }>(rows: readonly T[]) => rows.filter((r) => r.workspace_id === ws && r.deleted_at === null);
  const attributesOf = new Map<Uuid, Attribute[]>();
  for (const a of live(db.attribute)) (attributesOf.get(a.entity_id) ?? attributesOf.set(a.entity_id, []).get(a.entity_id)!).push(a);
  for (const list of attributesOf.values()) list.sort((a, b) => a.sort_order - b.sort_order);
  const logical = live(db.entity)
    .filter((e) => e.model_level === "logical" && (attributesOf.get(e.id)?.length ?? 0) >= 2 && (attributesOf.get(e.id)?.length ?? 0) <= 30)
    .slice(0, STAR_LOGICAL);
  if (logical.length < STAR_LOGICAL) throw new Error(`"Performance test" has ${logical.length} logical entities of 2 to 30 attributes; ${STAR_LOGICAL} are needed.`);
  const sample = { entity: logical[0]!, attribute: attributesOf.get(logical[0]!.id)![0]!, relationship: live(db.relationship)[0] };

  // the facts and dimensions, in the logical entities' concepts
  const dimensional: Entity[] = [];
  const dimensionalAttributes = new Map<Uuid, Attribute[]>();
  db.cube_entity ??= [];
  for (let n = 0; n < STAR_CARDS; n++) {
    const fact = n < 20;
    const entity: Entity = {
      ...sample.entity,
      ...std(`entity:${n}`),
      concept_id: logical[n % STAR_LOGICAL]!.concept_id,
      name: `${fact ? "Fact" : "Dim"} ${n + 1}`,
      alias: null,
      model_level: "dimensional",
      stereotype: "object",
      definition_html: null,
      definition_text: null,
    };
    db.entity.push(entity);
    dimensional.push(entity);
    db.cube_entity.push({ ...std(`cube-entity:${n}`), entity_id: entity.id, role: fact ? "fact" : "dimension", grain: fact ? "One row per measured event" : null, scd_type: fact ? null : 1 } as CubeEntity);
    const attributes: Attribute[] = [];
    for (let k = 0; k < 8; k++) {
      const a: Attribute = {
        ...sample.attribute,
        ...std(`attribute:${n}.${k}`),
        entity_id: entity.id,
        name: k === 0 ? `${fact ? "fact" : "dim"}_${n + 1}_key` : `attribute_${k}`,
        alias: null,
        sort_order: k,
        data_type: k === 0 ? "integer" : "string",
        custom_type: null,
        type_length: null,
        type_precision: null,
        type_scale: null,
        is_primary_key: k === 0,
        is_foreign_key: false,
        is_business_key: false,
        is_pii: false,
        is_nullable: k !== 0,
        definition_html: null,
        definition_text: null,
        copied_from_attribute_id: null,
      };
      db.attribute.push(a);
      attributes.push(a);
    }
    dimensionalAttributes.set(entity.id, attributes);
  }

  // the canvas and its cards
  db.canvas.push({ ...from, ...std("canvas"), id: STAR_CANVAS_ID, name: STAR_CANVAS_NAME, live_label_id: null, look: { ...from.look }, entity_names: null, attribute_names: null });
  db.project_canvas.push({ project_id: LARGE_IDS.project, canvas_id: STAR_CANVAS_ID, workspace_id: ws, sort_order: db.project_canvas.filter((l) => l.project_id === LARGE_IDS.project).length, added_at: at, added_by: by });
  const card = (key: string, entityId: Uuid, p: { x: number; y: number }) =>
    db.canvas_item.push({
      ...std(`card:${key}`),
      canvas_id: STAR_CANVAS_ID,
      entity_id: entityId,
      source_table_id: null,
      requirement_id: null,
      x: p.x,
      y: p.y,
      width: null,
      collapsed: false,
      row_filter: "all",
      frame_id: null,
      live_level: null,
      entity_names: null,
      attribute_names: null,
    });
  logical.forEach((e, n) => card(`logical:${n}`, e.id, place(n, "logical")));
  dimensional.forEach((e, n) => card(`dimensional:${n}`, e.id, place(n, "dimensional")));

  // 300 lines: attributes 1–6 of each fact or dimension, fed from the logical card of its number (its neighbour on the
  // left for the first 40); attributes 5 and 6 of the first 30 are transformations that also read the next logical card
  const inputOf = (n: number, k: number) => {
    const list = attributesOf.get(logical[n % STAR_LOGICAL]!.id)!;
    return list[k % list.length]!;
  };
  let count = 0;
  db.cube_mapping ??= [];
  db.cube_mapping_input ??= [];
  for (let n = 0; n < STAR_CARDS; n++) {
    for (let k = 1; k <= 6; k++) {
      const target = dimensionalAttributes.get(dimensional[n]!.id)![k]!;
      const transform = n < 30 && k >= 5;
      const inputs = transform ? [inputOf(n, k), inputOf(n + 1, k)] : [inputOf(n, k)];
      if (joined === "mappings") {
        const mapping = { ...std(`cube-mapping:${n}.${k}`), attribute_id: target.id, kind: transform ? "transform" : "direct", rule_expression: transform ? "a || b" : null, status: k % 3 === 0 ? "draft" : "approved", note: null, approved_by: k % 3 === 0 ? null : by, approved_at: k % 3 === 0 ? null : at } as CubeMapping;
        db.cube_mapping.push(mapping);
        inputs.forEach((input, i) => db.cube_mapping_input!.push({ ...std(`cube-mapping-input:${n}.${k}.${i}`), mapping_id: mapping.id, attribute_id: input.id, sort_order: i } as CubeMappingInput));
      } else {
        const relationship: Relationship = {
          ...(sample.relationship as Relationship),
          ...std(`relationship:${n}.${k}`),
          from_entity_id: inputs[0]!.entity_id,
          to_entity_id: dimensional[n]!.id,
          label: null,
          from_min: 1,
          from_max: "1",
          to_min: 0,
          to_max: "n",
          description: null,
          from_role: null,
          to_role: null,
        };
        db.relationship.push(relationship);
      }
      count++;
    }
  }
  if (count !== STAR_LINES) throw new Error(`${count} lines, not ${STAR_LINES}`);
  await writeDb(file, db);
  return true;
}
