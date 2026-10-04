// The demo model of the prototype (seed() in docs/prototype/infomapper-model-prototype.html): concepts, entities with
// their attributes, source systems with tables and columns, mappings with statuses and rules, relationships, and the
// cards on the two seeded canvases at the prototype's positions, without frames (frames come in slice 2).

import { createHash } from "node:crypto";
import type { Uuid } from "@/domain/ids";
import { parseColumnLines } from "@/domain/model/column-lines";
import { plainTextPair } from "@/domain/model/plain-text";
import type {
  CanvasItem,
  Concept,
  Entity,
  LogicalType,
  Mapping,
  MappingStatus,
  SourceColumn,
  SourceTable,
  Stereotype,
} from "@/domain/types";
import type { DevDb } from "./schema";

/**
 * A fixed id for a seed row, derived from its workspace and a readable key (`entity:customer`), so ids stay the same
 * after "npm run reset-dev-data" and tests can name rows. Shaped like the other seed ids (UUID v7 layout).
 */
export function seedId(workspaceId: Uuid, key: string): Uuid {
  const h = createHash("sha1").update(`${workspaceId}/${key}`).digest("hex");
  const variant = "89ab"[parseInt(h[7]!, 16) & 3];
  return `01a0f9e9-${h.slice(0, 4)}-7${h.slice(4, 7)}-${variant}${h.slice(8, 11)}-${h.slice(11, 23)}`;
}

type Flags = string; // "PK", "FK", "PII", "BK", combined with spaces

const CONCEPTS: [key: string, name: string, color: string][] = [
  ["cust", "Customer", "#2F7DD1"],
  ["sales", "Sales", "#0F8B8D"],
  ["prod", "Product", "#C0437A"],
  ["ref", "Reference data", "#5F8A2E"],
];

const ENTITIES: [key: string, concept: string, name: string, stereotype: Stereotype, definition: string][] = [
  ["customer", "cust", "Customer", "object", "A person or organisation that buys from us."],
  ["address", "cust", "Customer Address", "object", ""],
  ["order", "sales", "Sales Order", "object", "A confirmed order placed by a customer."],
  ["line", "sales", "Order Line", "link", "One product on one order."],
  ["product", "prod", "Product", "object", ""],
  ["country", "ref", "Country", "dictionary", ""],
];

const ATTRIBUTES: Record<string, [name: string, type: LogicalType, flags?: Flags][]> = {
  customer: [
    ["customer_id", "integer", "PK"],
    ["customer_number", "string"],
    ["first_name", "string", "PII"],
    ["last_name", "string", "PII"],
    ["email", "string", "PII"],
    ["birth_date", "date", "PII"],
    ["segment_code", "string"],
    ["created_at", "date"],
  ],
  address: [
    ["address_id", "integer", "PK"],
    ["customer_id", "integer", "FK"],
    ["street", "string", "PII"],
    ["city", "string"],
    ["postal_code", "string"],
    ["country_code", "string", "FK"],
  ],
  order: [
    ["order_id", "integer", "PK"],
    ["order_number", "string"],
    ["customer_id", "integer", "FK"],
    ["order_date", "date"],
    ["total_amount", "decimal"],
    ["currency_code", "string"],
    ["status_code", "string"],
  ],
  line: [
    ["order_line_id", "integer", "PK"],
    ["order_id", "integer", "FK"],
    ["product_id", "integer", "FK"],
    ["quantity", "integer"],
    ["unit_price", "decimal"],
    ["discount_pct", "decimal"],
  ],
  product: [
    ["product_id", "integer", "PK"],
    ["sku", "string"],
    ["product_name", "string"],
    ["category_code", "string"],
    ["list_price", "decimal"],
  ],
  country: [
    ["country_code", "string", "PK"],
    ["country_name", "string"],
  ],
};

const TABLES: [key: string, system: string, database: string, schema: string, name: string, rows: number, columns: [string, string, Flags?][]][] = [
  ["customers", "CRM", "crmprod", "dbo", "customers", 182340, [
    ["cust_id", "int", "PK"], ["cust_no", "varchar(20)", "BK"], ["fname", "nvarchar(50)", "PII"], ["lname", "nvarchar(50)", "PII"],
    ["email_addr", "varchar(120)", "PII"], ["dob", "date", "PII"], ["segment", "char(3)"], ["created_ts", "datetime2"], ["updated_ts", "datetime2"],
  ]],
  ["addr", "CRM", "crmprod", "dbo", "customer_addresses", 240118, [
    ["addr_id", "int", "PK"], ["cust_id", "int", "FK"], ["street_line1", "nvarchar(100)", "PII"], ["city", "nvarchar(60)"], ["zip", "varchar(10)"], ["country_iso", "char(2)"],
  ]],
  ["webusers", "WEB", "shopdb", "public", "web_users", 96412, [
    ["user_id", "uuid", "PK"], ["email", "varchar(255)", "PII"], ["cust_no", "varchar(20)", "BK"], ["registered_at", "timestamp"],
  ]],
  ["ordhdr", "ERP", "erpdb", "sales", "order_header", 1204553, [
    ["ord_id", "bigint", "PK"], ["ord_no", "varchar(20)", "BK"], ["cust_ref", "varchar(20)"], ["ord_dt", "date"], ["ord_total", "decimal(12,2)"], ["curr", "char(3)"], ["ord_status", "tinyint"],
  ]],
  ["ordline", "ERP", "erpdb", "sales", "order_line", 4870211, [
    ["line_id", "bigint", "PK"], ["ord_id", "bigint", "FK"], ["item_code", "varchar(30)"], ["qty", "int"], ["price", "decimal(10,2)"], ["disc", "decimal(5,2)"],
  ]],
  ["items", "ERP", "erpdb", "inv", "items", 15230, [
    ["item_code", "varchar(30)", "PK BK"], ["item_desc", "nvarchar(200)"], ["cat_code", "varchar(10)"], ["list_prc", "decimal(10,2)"],
  ]],
];

const MAPPINGS: [table: string, column: string, entity: string, attribute: string, status?: MappingStatus, rule?: string, note?: string][] = [
  ["customers", "cust_id", "customer", "customer_id"],
  ["customers", "cust_no", "customer", "customer_number"],
  ["customers", "fname", "customer", "first_name"],
  ["customers", "lname", "customer", "last_name"],
  ["customers", "email_addr", "customer", "email"],
  ["customers", "dob", "customer", "birth_date", "review"],
  ["customers", "created_ts", "customer", "created_at", "review", "CAST(created_ts AS date)"],
  ["webusers", "email", "customer", "email", "draft", undefined, "Second source for e-mail. Decide the priority rule with the data owner."],
  ["ordhdr", "ord_id", "order", "order_id"],
  ["ordhdr", "ord_no", "order", "order_number"],
  ["ordhdr", "ord_dt", "order", "order_date"],
  ["ordhdr", "ord_total", "order", "total_amount"],
  ["ordhdr", "ord_status", "order", "status_code", "draft", "Decode with the ERP status dictionary (ref.order_status)"],
  ["ordline", "item_code", "line", "product_id", "draft"],
];

const RELATIONSHIPS: [from: string, to: string, label: string, toMin: 0 | 1][] = [
  ["customer", "order", "places", 0],
  ["order", "line", "contains", 1],
  ["product", "line", "is ordered on", 0],
  ["customer", "address", "lives at", 0],
  ["country", "address", "locates", 0],
];

/** Card positions per canvas, as in the prototype's seed. */
export const DEMO_LAYOUT = {
  customerOrders: {
    entities: { customer: [496, 40], order: [496, 568], line: [840, 568] },
    tables: { customers: [40, 40], webusers: [40, 376], ordhdr: [40, 584], ordline: [1176, 600] },
  },
  orderLines: {
    entities: { line: [520, 40], product: [520, 344] },
    tables: { ordline: [40, 40], items: [40, 344] },
  },
} as const;

type Layout = { entities: Record<string, readonly [number, number]>; tables: Record<string, readonly [number, number]> };

export interface DemoModelOptions {
  workspaceId: Uuid;
  at: string;
  /** Who created the model rows and the mappings (the four-eyes author). */
  authorId: Uuid;
  /** Who approved the approved mappings. */
  approverId: Uuid;
  /** Canvases and the cards on them. */
  canvases: { canvasId: Uuid; layout: Layout }[];
}

/** Adds the prototype's model to one workspace of the seed. */
export function addDemoModel(db: DevDb, o: DemoModelOptions): void {
  const id = (key: string) => seedId(o.workspaceId, key);
  const std = (key: string) => ({
    id: id(key),
    workspace_id: o.workspaceId,
    version: 1,
    created_at: o.at,
    created_by: o.authorId,
    updated_at: o.at,
    updated_by: o.authorId,
    deleted_at: null,
  });
  const has = (flags: Flags | undefined, flag: string) => (flags ?? "").split(" ").includes(flag);

  CONCEPTS.forEach(([key, name, color], i) => {
    const row: Concept = { ...std(`concept:${key}`), name, description_html: null, description_text: null, color, sort_order: i };
    db.concept.push(row);
  });

  for (const [key, concept, name, stereotype, definition] of ENTITIES) {
    const text = plainTextPair(definition);
    const row: Entity = { ...std(`entity:${key}`), concept_id: id(`concept:${concept}`), name, stereotype, definition_html: text.html, definition_text: text.text };
    db.entity.push(row);
    ATTRIBUTES[key]!.forEach(([attr, type, flags], i) => {
      db.attribute.push({
        ...std(`attribute:${key}.${attr}`),
        entity_id: row.id,
        name: attr,
        sort_order: i,
        data_type: type,
        custom_type: null,
        type_length: null,
        type_precision: null,
        type_scale: null,
        is_primary_key: has(flags, "PK"),
        is_foreign_key: has(flags, "FK"),
        is_business_key: false,
        is_pii: has(flags, "PII"),
        is_nullable: !has(flags, "PK"),
        definition_html: null,
        definition_text: null,
      });
    });
  }

  for (const system of [...new Set(TABLES.map((t) => t[1]))]) {
    db.source_system.push({ ...std(`system:${system}`), name: system, description: null });
  }
  for (const [key, system, database, schema, name, rows, columns] of TABLES) {
    const table: SourceTable = {
      ...std(`table:${key}`),
      source_system_id: id(`system:${system}`),
      database_name: database,
      schema_name: schema,
      name,
      object_type: "table",
      row_count: rows,
      comment: null,
    };
    db.source_table.push(table);
    const parsed = parseColumnLines(columns.map(([n, t]) => `${n} ${t}`).join("\n"));
    if (!parsed.ok) throw new Error(`Seed table ${name}: ${parsed.error.message}`);
    parsed.columns.forEach((c, i) => {
      const flags = columns[i]![2];
      const column: SourceColumn = {
        ...std(`column:${key}.${c.name}`),
        source_table_id: table.id,
        ...c,
        ordinal: i + 1,
        is_nullable: !has(flags, "PK"),
        is_primary_key: has(flags, "PK"),
        is_foreign_key: has(flags, "FK"),
        is_business_key: has(flags, "BK"),
        is_pii: has(flags, "PII"),
        default_value: null,
        comment: null,
      };
      db.source_column.push(column);
    });
  }

  for (const [table, column, entity, attribute, status = "approved", rule, note] of MAPPINGS) {
    const key = `mapping:${table}.${column}>${entity}.${attribute}`;
    const text = plainTextPair(note);
    const mapping: Mapping = {
      ...std(key),
      attribute_id: id(`attribute:${entity}.${attribute}`),
      kind: rule ? "transform" : "direct",
      rule_expression: rule ?? null,
      status,
      note_html: text.html,
      note_text: text.text,
      approved_by: status === "approved" ? o.approverId : null,
      approved_at: status === "approved" ? o.at : null,
    };
    db.mapping.push(mapping);
    db.mapping_input.push({ ...std(`${key}#0`), mapping_id: mapping.id, source_column_id: id(`column:${table}.${column}`), sort_order: 0 });
  }

  for (const [from, to, label, toMin] of RELATIONSHIPS) {
    db.relationship.push({
      ...std(`relationship:${from}>${to}`),
      from_entity_id: id(`entity:${from}`),
      to_entity_id: id(`entity:${to}`),
      label,
      from_min: 1,
      from_max: "1",
      to_min: toMin,
      to_max: "n",
      description: null,
    });
  }

  for (const { canvasId, layout } of o.canvases) {
    const card = (key: string, target: Pick<CanvasItem, "entity_id" | "source_table_id">, [x, y]: readonly [number, number]): CanvasItem => ({
      ...std(`card:${canvasId}:${key}`),
      canvas_id: canvasId,
      requirement_id: null,
      ...target,
      x,
      y,
      width: null,
      collapsed: false,
      row_filter: "all",
      frame_id: null,
      live_level: null,
    });
    for (const [key, xy] of Object.entries(layout.entities)) db.canvas_item.push(card(`entity:${key}`, { entity_id: id(`entity:${key}`), source_table_id: null }, xy));
    for (const [key, xy] of Object.entries(layout.tables)) db.canvas_item.push(card(`table:${key}`, { entity_id: null, source_table_id: id(`table:${key}`) }, xy));
  }
}
