// Slice 20's demo for the model checks (PRD item 7; prototype `checksDemo`; Łukasz's step 1 answers 1 and 11): the demo
// model's foreign keys become copies of their primary keys (D-63), and a few things the checks find are added:
//   - Customer.last_order_id, a copy of Sales Order.order_id (a key copied the wrong way: Customer is the one side);
//   - Product.country_code, a copy of Country.country_code (a key copied without a relationship);
//   - Product.Product_Name beside product_name (a duplicate name, case ignored);
//   - Sales Order.total_amount calculated, with no inputs, beside its approved mapping (calculated and mapped);
//   - Customer Address.country_code no longer a foreign key (Country – Customer Address has no copied key).
// Only InfoMapper's tables. Run by `npm run seed`, `npm run reset-dev-data`, `npm run demo` and slice 20's fixtures, in
// "Retail Co – DWH" only; never by the plain e2e reseed or earlier slices' fixtures, and never on KB's file.

import type { Uuid } from "@/domain/ids";
import type { Attribute } from "@/domain/types";
import type { DevDb } from "./schema";
import { seedId } from "./seed-model";

/** The copies the demo makes: copy → original, as "{entity key}.{attribute}". */
const COPIES: [copy: string, original: string][] = [
  ["order.customer_id", "customer.customer_id"],
  ["address.customer_id", "customer.customer_id"],
  ["line.order_id", "order.order_id"],
  ["line.product_id", "product.product_id"],
];

/** The attributes the demo adds: entity, name, original (a copy, so a foreign key with its original's type) or a type. */
const ADDED: [entity: string, name: string, from: { copyOf: string } | { type: Attribute["data_type"] }][] = [
  ["customer", "last_order_id", { copyOf: "order.order_id" }],
  ["product", "country_code", { copyOf: "country.country_code" }],
  ["product", "Product_Name", { type: "string" }],
];

export const CHECKS_DEMO_RULE = "Sum of its order lines' net amounts";

/** Adds the demo's checks; false when it ran already or the demo model is not in the workspace. */
export function addChecksDemo(db: DevDb, workspaceId: Uuid, authorId: Uuid, at: string = new Date().toISOString()): boolean {
  const id = (key: string) => seedId(workspaceId, key);
  const attribute = (key: string) => db.attribute.find((a) => a.id === id(`attribute:${key}`) && a.deleted_at === null);
  const needed = [...COPIES.flat(), "address.country_code", "order.total_amount", "country.country_code"];
  if (needed.some((k) => !attribute(k))) return false;
  if (db.attribute.some((a) => a.id === id("attribute:customer.last_order_id"))) return false;

  for (const [copy, original] of COPIES) attribute(copy)!.copied_from_attribute_id = attribute(original)!.id;
  attribute("address.country_code")!.is_foreign_key = false;
  Object.assign(attribute("order.total_amount")!, { is_calculated: true, calc_rule: CHECKS_DEMO_RULE });

  for (const [entityKey, name, from] of ADDED) {
    const entityId = id(`entity:${entityKey}`);
    const original = "copyOf" in from ? attribute(from.copyOf)! : null;
    const order = Math.max(-1, ...db.attribute.filter((a) => a.entity_id === entityId && a.deleted_at === null).map((a) => a.sort_order)) + 1;
    db.attribute.push({
      id: id(`attribute:${entityKey}.${name}`),
      workspace_id: workspaceId,
      version: 1,
      created_at: at,
      created_by: authorId,
      updated_at: at,
      updated_by: authorId,
      deleted_at: null,
      entity_id: entityId,
      name,
      alias: null,
      sort_order: order,
      // a copy follows its original's type and Personal data (D-63)
      data_type: original ? original.data_type : "copyOf" in from ? "string" : from.type,
      custom_type: original?.custom_type ?? null,
      type_length: original?.type_length ?? null,
      type_precision: original?.type_precision ?? null,
      type_scale: original?.type_scale ?? null,
      is_primary_key: false,
      is_foreign_key: !!original,
      is_business_key: false,
      is_pii: original?.is_pii ?? false,
      is_nullable: true,
      definition_html: null,
      definition_text: null,
      copied_from_attribute_id: original?.id ?? null,
      is_calculated: false,
      calc_rule: null,
    });
  }
  return true;
}
