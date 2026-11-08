// A small star for InfoCube's domain tests (slice 15b): Fact Sales with Dim Date as Order date and as Ship date and Dim
// Customer without a role, Fact Orders with Dim Date as Order date, each relationship linked to its key explicitly. Built
// on InfoMapper's fixtures; plain rows, no store.

import { attribute, entity, ids, relationship } from "@/domain/__fixtures__/domain";
import type { Attribute, Entity, Relationship } from "@/domain/types";
import type { CubeModel } from "../keys";
import { typeColumns, type CubeEntity, type CubeKey, type CubeMeasure } from "../types";

const id = (n: number) => `01900000-0000-7000-8000-0000000c${n.toString(16).padStart(4, "0")}`;

export const S = {
  sales: id(0x101),
  orders: id(0x102),
  date: id(0x103),
  cust: id(0x104),
  // Fact Sales' attributes
  dateKey: id(0x201),
  shipKey: id(0x202),
  custKey: id(0x203),
  quantity: id(0x204),
  orderNumber: id(0x205),
  // Fact Orders' attributes
  ordersDateKey: id(0x211),
  ordersTotal: id(0x212),
  // the dimensions' primary keys
  datePk: id(0x221),
  custPk: id(0x222),
  // relationships
  orderDate: id(0x301),
  shipDate: id(0x302),
  customer: id(0x303),
  ordersDate: id(0x304),
  // InfoCube's rows
  cubeSales: id(0x401),
  cubeOrders: id(0x402),
  cubeDate: id(0x403),
  cubeCust: id(0x404),
  mQuantity: id(0x501),
  mTotal: id(0x502),
  kOrderDate: id(0x601),
  kShipDate: id(0x602),
  kCustomer: id(0x603),
  kOrdersDate: id(0x604),
} as const;

const dim = (eid: string, name: string): Entity => entity(eid, { name, model_level: "dimensional", concept_id: ids.conceptSales });
const attr = (aid: string, entityId: string, name: string, sort: number, over: Partial<Attribute> = {}): Attribute =>
  attribute(aid, { entity_id: entityId, name, sort_order: sort, data_type: "integer", type_length: null, is_primary_key: false, is_foreign_key: false, is_pii: false, is_nullable: true, ...over });
const fk = { is_foreign_key: true, is_nullable: false };
const rel = (rid: string, dimension: string, fact: string, role: string | null): Relationship =>
  relationship({ id: rid, from_entity_id: dimension, to_entity_id: fact, label: "dates", from_role: role });
const cube = (cid: string, entityId: string, role: CubeEntity["role"], over: Partial<CubeEntity> = {}): CubeEntity => ({
  ...std(cid),
  entity_id: entityId,
  role,
  grain: role === "fact" ? "One row per order line" : null,
  ...typeColumns(role),
  ...over,
});
function std(rowId: string) {
  return { id: rowId, workspace_id: ids.ws, version: 1, created_at: "2026-11-04T08:00:00.000Z", created_by: ids.actor, updated_at: "2026-11-04T08:00:00.000Z", updated_by: ids.actor, deleted_at: null };
}
const key = (kid: string, relationshipId: string, attributeId: string): CubeKey => ({ ...std(kid), relationship_id: relationshipId, attribute_id: attributeId });
const measure = (mid: string, attributeId: string, over: Partial<CubeMeasure> = {}): CubeMeasure => ({ ...std(mid), attribute_id: attributeId, additivity: "additive", semi_note: null, ...over });

/** The star: every relationship linked, Fact Sales' quantity and Fact Orders' total_amount measures. */
export function star(): CubeModel & { entities: Entity[]; attributes: Attribute[]; relationships: Relationship[]; cubeEntities: CubeEntity[]; cubeMeasures: CubeMeasure[]; cubeKeys: CubeKey[] } {
  return {
    entities: [dim(S.sales, "Fact Sales"), dim(S.orders, "Fact Orders"), dim(S.date, "Dim Date"), dim(S.cust, "Dim Customer")],
    attributes: [
      attr(S.dateKey, S.sales, "date_key", 0, fk),
      attr(S.shipKey, S.sales, "ship_date_key", 1, fk),
      attr(S.custKey, S.sales, "customer_key", 2, fk),
      attr(S.quantity, S.sales, "quantity", 3),
      attr(S.orderNumber, S.sales, "order_number", 4, { data_type: "string", type_length: 20 }),
      attr(S.ordersDateKey, S.orders, "date_key", 0, fk),
      attr(S.ordersTotal, S.orders, "total_amount", 1, { data_type: "decimal", type_precision: 12, type_scale: 2 }),
      attr(S.datePk, S.date, "date_key", 0, { is_primary_key: true, is_nullable: false }),
      attr(S.custPk, S.cust, "customer_key", 0, { is_primary_key: true, is_nullable: false }),
    ],
    relationships: [rel(S.orderDate, S.date, S.sales, "Order date"), rel(S.shipDate, S.date, S.sales, "Ship date"), rel(S.customer, S.cust, S.sales, null), rel(S.ordersDate, S.date, S.orders, "Order date")],
    cubeEntities: [cube(S.cubeSales, S.sales, "fact"), cube(S.cubeOrders, S.orders, "fact"), cube(S.cubeDate, S.date, "dimension"), cube(S.cubeCust, S.cust, "dimension")],
    cubeMeasures: [measure(S.mQuantity, S.quantity), measure(S.mTotal, S.ordersTotal)],
    cubeKeys: [key(S.kOrderDate, S.orderDate, S.dateKey), key(S.kShipDate, S.shipDate, S.shipKey), key(S.kCustomer, S.customer, S.custKey), key(S.kOrdersDate, S.ordersDate, S.ordersDateKey)],
  };
}

export { attr, rel, key, measure };
