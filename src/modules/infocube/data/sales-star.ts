// The demo star (slice 15a, O5, acceptance doc Q13 (b); prototype `cubeDemo`, `cubeDemoV2`): Fact Sales, Fact Orders,
// Dim Customer, Dim Product and Dim Date with their attributes and roles, the relationships from each dimension to the
// facts, the canvas "Sales star" in Order management, InfoMate's licence and InfoCube on in "Retail Co – DWH".
//
// A step for the development file (`npm run seed`, `npm run reset-dev-data`) and slice 15's specs only: earlier specs'
// data has no InfoCube data and no licence, so their counts and the element guard stay as they were. Since slice 15b
// the facts' measures, Dim Date's roles (Order date, and Ship date with `ship_date_key`, RP-F) and every relationship's
// key link. Since slice 15c the prototype's 20 dimensional mappings (`cubeDemo`, `cubeDemoV2`); since slice 15d REQ-210.

import { seedId } from "@/data/local/seed-model";
import type { DevDb } from "@/data/local/schema";
import type { Uuid } from "@/domain/ids";
import { DEFAULT_CANVAS_LOOK, type Attribute, type CanvasItem, type LogicalType } from "@/domain/types";
import type { Additivity, CubeEntity, CubeMappingKind, CubeMappingStatus, CubeRole, ScdType } from "../domain/types";
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
  sales: [["date_key", "integer", "FK"], ["ship_date_key", "integer", "FK"], ["customer_key", "integer", "FK"], ["product_key", "integer", "FK"], ["order_number", "string"], ["quantity", "integer"], ["unit_price", "decimal"], ["discount_pct", "decimal"], ["net_amount", "decimal"]],
  cust: [["customer_key", "integer", "PK"], ["customer_number", "string"], ["segment_code", "string"], ["city", "string"], ["country_name", "string"]],
  prod: [["product_key", "integer", "PK"], ["sku", "string"], ["product_name", "string"], ["category_code", "string"]],
  date: [["date_key", "integer", "PK"], ["calendar_date", "date"], ["year", "integer"], ["month", "integer"], ["day_of_week", "string"]],
  orders: [["date_key", "integer", "FK"], ["customer_key", "integer", "FK"], ["order_number", "string"], ["total_amount", "decimal"], ["line_count", "integer"]],
};

/**
 * Each dimension's relationships to the facts: the dimension is the 1..1 end (D-67). Slice 15b (role-playing RP-F): Dim
 * Date plays Order date and Ship date in Fact Sales and Order date in Fact Orders, its role at its own end; each
 * relationship is carried by the fact's key named here, linked explicitly (RP-C: never matched by name). The second
 * Fact Sales – Dim Date relationship has a key of its own in the ids (`:ship`).
 */
const RELATIONSHIPS: [dimension: string, fact: string, label: string, role: string | null, key: string, id?: string][] = [
  ["cust", "sales", "describes", null, "customer_key"],
  ["prod", "sales", "describes", null, "product_key"],
  ["date", "sales", "dates", "Order date", "date_key"],
  ["date", "sales", "dates", "Ship date", "ship_date_key", "ship"],
  ["cust", "orders", "describes", null, "customer_key"],
  ["date", "orders", "dates", "Order date", "date_key"],
];

/** The facts' measures and their additivity, as the prototype's demo (`cubeDemo`, `cubeDemoV2`); slice 15b. */
const MEASURES: [fact: string, attribute: string, additivity: Additivity][] = [
  ["sales", "quantity", "additive"],
  ["sales", "unit_price", "non"],
  ["sales", "discount_pct", "non"],
  ["sales", "net_amount", "additive"],
  ["orders", "total_amount", "additive"],
  ["orders", "line_count", "additive"],
];

const DATE_KEY_RULE = "CONVERT(int, FORMAT(order_date, 'yyyyMMdd'))";
const CUSTOMER_KEY_RULE = "Look up customer_key in Dim Customer by customer_id, the version valid on order_date";

/**
 * The prototype's dimensional mappings (slice 15c; `cubeDemo` l. 1556–1565, `cubeDemoV2` l. 1580–1599): the target as
 * "{star key}.{attribute}", the inputs as "{demo model key}.{attribute}". Approved unless named; unfed: Dim Date's
 * attributes, the dimensions' keys and `ship_date_key`. IC-10's figures follow: Order Line feeds six, four approved.
 */
const MAPPINGS: [target: string, inputs: string[], kind: CubeMappingKind, rule: string | null, status: CubeMappingStatus, note?: string][] = [
  ["sales.date_key", ["order.order_date"], "transform", DATE_KEY_RULE, "approved"],
  ["sales.customer_key", ["order.customer_id"], "transform", CUSTOMER_KEY_RULE, "approved"],
  ["sales.product_key", ["line.product_id"], "transform", "Look up product_key in Dim Product by product_id", "approved"],
  ["sales.order_number", ["order.order_number"], "direct", null, "approved"],
  ["sales.quantity", ["line.quantity"], "direct", null, "approved"],
  ["sales.unit_price", ["line.unit_price"], "direct", null, "approved"],
  ["sales.discount_pct", ["line.discount_pct"], "direct", null, "approved"],
  ["sales.net_amount", ["line.quantity", "line.unit_price", "line.discount_pct"], "transform", "quantity * unit_price * (1 - discount_pct / 100)", "review"],
  ["cust.customer_number", ["customer.customer_number"], "direct", null, "approved"],
  ["cust.segment_code", ["customer.segment_code"], "direct", null, "approved"],
  ["cust.city", ["address.city"], "direct", null, "draft", "A customer can have several addresses. Which one feeds the dimension: the latest, or the billing address?"],
  ["cust.country_name", ["country.country_name"], "direct", null, "approved"],
  ["prod.sku", ["product.sku"], "direct", null, "approved"],
  ["prod.product_name", ["product.product_name"], "direct", null, "approved"],
  ["prod.category_code", ["product.category_code"], "direct", null, "approved"],
  ["orders.date_key", ["order.order_date"], "transform", DATE_KEY_RULE, "approved"],
  ["orders.customer_key", ["order.customer_id"], "transform", CUSTOMER_KEY_RULE, "approved"],
  ["orders.order_number", ["order.order_number"], "direct", null, "approved"],
  ["orders.total_amount", ["order.total_amount"], "direct", null, "approved"],
  ["orders.line_count", ["line.order_line_id"], "transform", "COUNT(order_line_id) per order", "draft"],
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

/** REQ-210 (slice 15d, the prototype's texts): net sales by customer segment and month, on the star's attributes. */
export const REQ_210 = {
  key: "REQ-210",
  name: "Net sales by customer segment and month",
  description: "Sales reports show net sales per customer segment per calendar month.",
  owner: "Head of Sales",
  links: ["sales.net_amount", "cust.segment_code", "date.month"],
} as const;

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
  const cubeMeasures = (db.cube_measure ??= []);
  const cubeKeys = (db.cube_key ??= []);
  const cubeMappings = (db.cube_mapping ??= []);
  const cubeMappingInputs = (db.cube_mapping_input ??= []);

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
        is_calculated: false,
        calc_rule: null,
      };
      db.attribute.push(row);
    });
    const cube: CubeEntity = { ...std(`cube-entity:${key}`), entity_id: id(`entity:${key}`), role, grain, scd_type: scd };
    cubeEntities.push(cube);
  }

  for (const [fact, attr, additivity] of MEASURES) {
    cubeMeasures.push({ ...std(`cube-measure:${fact}.${attr}`), attribute_id: id(`attribute:${fact}.${attr}`), additivity, semi_note: null });
  }

  for (const [dimension, fact, label, role, key, variant] of RELATIONSHIPS) {
    const relationship = `relationship:${dimension}>${fact}${variant ? `:${variant}` : ""}`;
    db.relationship.push({
      ...std(relationship),
      from_entity_id: id(`entity:${dimension}`),
      to_entity_id: id(`entity:${fact}`),
      label,
      from_min: 1,
      from_max: "1",
      to_min: 0,
      to_max: "n",
      description: null,
      from_role: role,
      to_role: null,
    });
    cubeKeys.push({ ...std(`cube-key:${relationship}`), relationship_id: id(relationship), attribute_id: id(`attribute:${fact}.${key}`) });
  }

  for (const [target, inputs, kind, rule, status, note] of MAPPINGS) {
    const mapping = `cube-mapping:${target}`;
    cubeMappings.push({
      ...std(mapping),
      attribute_id: id(`attribute:${target}`),
      kind,
      rule_expression: rule,
      status,
      note: note ?? null,
      approved_by: status === "approved" ? t.authorId : null,
      approved_at: status === "approved" ? at : null,
      lookup_relationship_id: null,
      lookup_default: null,
    });
    inputs.forEach((input, i) => {
      cubeMappingInputs.push({ ...std(`${mapping}<${input}`), mapping_id: id(mapping), attribute_id: model(`attribute:${input}`), sort_order: i });
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
  // slice 15d (O7, X-5; prototype `cubeDemo`): REQ-210 with its key as given, the requirement counter untouched; three
  // links to the star's attributes, no card on the canvas. Its coverage is 0 of 3 on purpose: the logical attributes
  // behind them have no source mappings.
  if (!db.requirement.some((r) => r.workspace_id === ws && r.key.toLowerCase() === REQ_210.key.toLowerCase())) {
    const requirementId = id("requirement:req-210");
    db.requirement.push({
      ...std("requirement:req-210"),
      key: REQ_210.key,
      kind: "data",
      name: REQ_210.name,
      description_html: `<p>${REQ_210.description}</p>`,
      description_text: REQ_210.description,
      expression: null,
      severity: null,
      status: "draft",
      priority: "must",
      owner_name: REQ_210.owner,
      external_ref: null,
      parent_id: null,
    });
    for (const target of REQ_210.links) {
      db.requirement_link.push({
        ...std(`requirement-link:req-210:${target}`),
        requirement_id: requirementId,
        entity_id: null,
        attribute_id: id(`attribute:${target}`),
        mapping_id: null,
        source_table_id: null,
        source_column_id: null,
      });
    }
  }
  const workspace = db.workspace.find((w) => w.id === ws);
  if (workspace) workspace.infocube = true;
  return true;
}
