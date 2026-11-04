// The demo star (slice 15a, O5, acceptance doc Q13 (b); prototype `cubeDemo`, `cubeDemoV2`): Fact Sales, Fact Orders,
// Dim Customer, Dim Product and Dim Date with their attributes and roles, the relationships from each dimension to the
// facts, the canvas "Sales star" in Order management, InfoMate's licence and InfoCube on in "Retail Co – DWH".
//
// A step for the development file (`npm run seed`, `npm run reset-dev-data`) and slice 15's specs only: earlier specs'
// data has no InfoCube data and no licence, so their counts and the element guard stay as they were. Measures and
// dimensional mappings come with 15b and 15c, REQ-210 with 15d.

import { seedId } from "@/data/local/seed-model";
import type { DevDb } from "@/data/local/schema";
import type { Uuid } from "@/domain/ids";
import { DEFAULT_CANVAS_LOOK, type Attribute, type CanvasItem, type LogicalType } from "@/domain/types";
import type { CubeEntity, CubeRole, ScdType } from "../domain/types";
import type { InfoCubeDb } from "./tables";

/** The seed's fixed ids this step reads (`SEED_IDS` in `src/data/local/seed.ts`, which this module may not import). */
export interface SalesStarTarget {
  workspaceId: Uuid;
  organizationId: Uuid;
  projectId: Uuid;
  /** Who wrote the rows. */
  authorId: Uuid;
}

const STAR: [key: string, concept: string, name: string, role: CubeRole, definition: string, grain: string | null, scd: ScdType | null][] = [
  ["sales", "sales", "Fact Sales", "fact", "Sales of products, one row per order line.", "One order line", null],
  ["cust", "cust", "Dim Customer", "dimension", "The customer as reports see it, with its history.", null, 2],
  ["prod", "prod", "Dim Product", "dimension", "", null, 1],
  ["date", "ref", "Dim Date", "dimension", "Generated calendar, one row per day.", null, 0],
  ["orders", "sales", "Fact Orders", "fact", "Orders as a whole, one row per order.", "One sales order", null],
];

const ATTRIBUTES: Record<string, [name: string, type: LogicalType, flags?: "PK" | "FK"][]> = {
  sales: [["date_key", "integer", "FK"], ["customer_key", "integer", "FK"], ["product_key", "integer", "FK"], ["order_number", "string"], ["quantity", "integer"], ["unit_price", "decimal"], ["discount_pct", "decimal"], ["net_amount", "decimal"]],
  cust: [["customer_key", "integer", "PK"], ["customer_number", "string"], ["segment_code", "string"], ["city", "string"], ["country_name", "string"]],
  prod: [["product_key", "integer", "PK"], ["sku", "string"], ["product_name", "string"], ["category_code", "string"]],
  date: [["date_key", "integer", "PK"], ["calendar_date", "date"], ["year", "integer"], ["month", "integer"], ["day_of_week", "string"]],
  orders: [["date_key", "integer", "FK"], ["customer_key", "integer", "FK"], ["order_number", "string"], ["total_amount", "decimal"], ["line_count", "integer"]],
};

/** Each dimension's relationships to the facts: the dimension is the 1..1 end (D-67). */
const RELATIONSHIPS: [dimension: string, fact: string, label: string][] = [
  ["cust", "sales", "describes"],
  ["prod", "sales", "describes"],
  ["date", "sales", "dates"],
  ["cust", "orders", "describes"],
  ["date", "orders", "dates"],
];

/** The prototype's positions on "Sales star": the logical model on the left, the star on the right. */
const LAYOUT: [kind: "entity" | "star", key: string, x: number, y: number][] = [
  ["entity", "customer", 40, 40],
  ["entity", "address", 40, 360],
  ["entity", "country", 40, 630],
  ["entity", "order", 380, 40],
  ["entity", "line", 380, 340],
  ["entity", "product", 380, 610],
  ["star", "cust", 780, 40],
  ["star", "date", 780, 320],
  ["star", "prod", 780, 600],
  ["star", "sales", 1140, 280],
  ["star", "orders", 1140, 640],
];

/** The star's ids, derived from the workspace as the demo model's are (`seedId`). */
export const starId = (workspaceId: Uuid, key: string) => seedId(workspaceId, `infocube:${key}`);
/** The canvas "Sales star". */
export const salesStarCanvasId = (workspaceId: Uuid) => starId(workspaceId, "canvas:sales-star");

/** Adds the star to a seeded file; false when it is there already or the demo model is not. */
export function addSalesStar(db: DevDb & Partial<InfoCubeDb>, t: SalesStarTarget, at: string = new Date().toISOString()): boolean {
  const ws = t.workspaceId;
  const model = (key: string) => seedId(ws, key);
  const id = (key: string) => starId(ws, key);
  if (db.entity.some((e) => e.id === id("entity:sales"))) return false;
  if (!["customer", "address", "order", "line", "product", "country"].every((k) => db.entity.some((e) => e.id === model(`entity:${k}`)))) return false;
  const std = (key: string) => ({ id: id(key), workspace_id: ws, version: 1, created_at: at, created_by: t.authorId, updated_at: at, updated_by: t.authorId, deleted_at: null });
  const cubeEntities = (db.cube_entity ??= []);
  db.cube_measure ??= [];

  for (const [key, concept, name, role, definition, grain, scd] of STAR) {
    db.entity.push({
      ...std(`entity:${key}`),
      concept_id: model(`concept:${concept}`),
      name,
      alias: null,
      model_level: "dimensional",
      stereotype: "object",
      definition_html: definition ? `<p>${definition}</p>` : null,
      definition_text: definition || null,
    });
    ATTRIBUTES[key]!.forEach(([attr, type, flag], i) => {
      const row: Attribute = {
        ...std(`attribute:${key}.${attr}`),
        entity_id: id(`entity:${key}`),
        name: attr,
        alias: null,
        sort_order: i,
        data_type: type,
        custom_type: null,
        type_length: null,
        type_precision: null,
        type_scale: null,
        is_primary_key: flag === "PK",
        is_foreign_key: flag === "FK",
        is_business_key: false,
        is_pii: false,
        is_nullable: !flag,
        definition_html: null,
        definition_text: null,
        copied_from_attribute_id: null,
      };
      db.attribute.push(row);
    });
    const cube: CubeEntity = { ...std(`cube-entity:${key}`), entity_id: id(`entity:${key}`), role, grain, scd_type: scd };
    cubeEntities.push(cube);
  }

  for (const [dimension, fact, label] of RELATIONSHIPS) {
    db.relationship.push({
      ...std(`relationship:${dimension}>${fact}`),
      from_entity_id: id(`entity:${dimension}`),
      to_entity_id: id(`entity:${fact}`),
      label,
      from_min: 1,
      from_max: "1",
      to_min: 0,
      to_max: "n",
      description: null,
    });
  }

  const canvasId = salesStarCanvasId(ws);
  db.canvas.push({ ...std("canvas:sales-star"), id: canvasId, name: "Sales star", live_label_id: null, look: { ...DEFAULT_CANVAS_LOOK }, entity_names: null, attribute_names: null });
  db.project_canvas.push({
    project_id: t.projectId,
    canvas_id: canvasId,
    workspace_id: ws,
    sort_order: db.project_canvas.filter((l) => l.project_id === t.projectId).length,
    added_at: at,
    added_by: t.authorId,
  });
  for (const [kind, key, x, y] of LAYOUT) {
    const item: CanvasItem = {
      ...std(`card:${kind}:${key}`),
      canvas_id: canvasId,
      entity_id: kind === "entity" ? model(`entity:${key}`) : id(`entity:${key}`),
      source_table_id: null,
      requirement_id: null,
      x,
      y,
      width: null,
      collapsed: false,
      row_filter: "all",
      frame_id: null,
      live_level: null,
      entity_names: null,
      attribute_names: null,
    };
    db.canvas_item.push(item);
  }

  if (!db.organization_licence.some((l) => l.organization_id === t.organizationId && l.module === "infocube" && l.deleted_at === null)) {
    db.organization_licence.push({ ...std("licence"), organization_id: t.organizationId, module: "infocube" });
  }
  const workspace = db.workspace.find((w) => w.id === ws);
  if (workspace) workspace.infocube = true;
  return true;
}
