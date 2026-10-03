// Test fixtures for domain unit tests. Not used by application code.

import type { CommandContext } from "../changes";
import type { WorkspaceAccess } from "../permissions";
import {
  DEFAULT_CANVAS_LOOK,
  type Attribute,
  type Canvas,
  type CanvasItem,
  type ChangeEvent,
  type Concept,
  type Entity,
  type Mapping,
  type MappingInput,
  type Organization,
  type OrganizationMember,
  type Project,
  type ProjectCanvas,
  type Relationship,
  type SourceColumn,
  type SourceSystem,
  type SourceTable,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from "../types";

export const T0 = "2026-10-01T08:00:00.000Z";
export const NOW = "2026-10-02T12:00:00.000Z";

export const ids = {
  org: "01900000-0000-7000-8000-000000000001",
  otherOrg: "01900000-0000-7000-8000-000000000002",
  ws: "01900000-0000-7000-8000-000000000010",
  actor: "01900000-0000-7000-8000-000000000100",
  someoneElse: "01900000-0000-7000-8000-000000000101",
  projectA: "01900000-0000-7000-8000-000000001001",
  projectB: "01900000-0000-7000-8000-000000001002",
  canvas1: "01900000-0000-7000-8000-000000002001",
  canvas2: "01900000-0000-7000-8000-000000002002",
  // model (slice 1a)
  conceptCustomer: "01900000-0000-7000-8000-000000003001",
  conceptSales: "01900000-0000-7000-8000-000000003002",
  customer: "01900000-0000-7000-8000-000000004001",
  salesOrder: "01900000-0000-7000-8000-000000004002",
  customerId: "01900000-0000-7000-8000-000000005001",
  email: "01900000-0000-7000-8000-000000005002",
  orderId: "01900000-0000-7000-8000-000000005003",
  relPlaces: "01900000-0000-7000-8000-000000006001",
  crm: "01900000-0000-7000-8000-000000007001",
  crmCustomer: "01900000-0000-7000-8000-000000008001",
  colCustId: "01900000-0000-7000-8000-000000009001",
  colEmail: "01900000-0000-7000-8000-000000009002",
  colFirstName: "01900000-0000-7000-8000-000000009003",
  mapEmail: "01900000-0000-7000-8000-00000000a001",
  inEmail: "01900000-0000-7000-8000-00000000b001",
  itemCustomer: "01900000-0000-7000-8000-00000000c001",
  itemCrmCustomer: "01900000-0000-7000-8000-00000000c002",
} as const;

/** A context whose ids count up predictably: 01900000-0000-7000-8000-9000000000NN. */
export function makeCtx(actorId: string = ids.actor): CommandContext & { issued: string[] } {
  const issued: string[] = [];
  return {
    actorId,
    now: NOW,
    issued,
    newId: () => {
      const id = `01900000-0000-7000-8000-9${String(issued.length + 1).padStart(11, "0")}`;
      issued.push(id);
      return id;
    },
  };
}

const standard = { version: 1, created_at: T0, created_by: ids.someoneElse, updated_at: T0, updated_by: ids.someoneElse, deleted_at: null };

export const organization = (over: Partial<Organization> = {}): Organization => ({
  id: ids.org,
  name: "InfoMate",
  ...standard,
  ...over,
});

export const organizationMember = (over: Partial<OrganizationMember> = {}): OrganizationMember => ({
  organization_id: ids.org,
  user_id: ids.actor,
  role: "member",
  created_at: T0,
  ...over,
});

export const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: ids.ws,
  organization_id: ids.org,
  name: "Retail Co – DWH",
  client_name: "Retail Co",
  description: null,
  doc_language: "en",
  dv2_mode: false,
  four_eyes: false,
  archived_at: null,
  archived_by: null,
  requirement_key_next: 101,
  ...standard,
  version: 3,
  ...over,
});

export const member = (role: WorkspaceRole, over: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  workspace_id: ids.ws,
  user_id: ids.actor,
  role,
  added_by: null,
  created_at: T0,
  ...over,
});

export const access = (role: WorkspaceRole | null, ws: Partial<Workspace> = {}): WorkspaceAccess => ({
  workspace: workspace(ws),
  member: role ? member(role) : null,
});

export const archived = { archived_at: T0, archived_by: ids.actor };

export const project = (id: string = ids.projectA, over: Partial<Project> = {}): Project => ({
  id,
  workspace_id: ids.ws,
  name: id === ids.projectA ? "Customer 360" : "Order management",
  description: null,
  ...standard,
  ...over,
});

export const canvas = (id: string = ids.canvas1, over: Partial<Canvas> = {}): Canvas => ({
  id,
  workspace_id: ids.ws,
  name: id === ids.canvas1 ? "Customer & orders" : "Order lines & products",
  live_label_id: null,
  look: { ...DEFAULT_CANVAS_LOOK },
  ...standard,
  version: 2,
  ...over,
});

export const link = (projectId: string, canvasId: string, sortOrder = 0): ProjectCanvas => ({
  project_id: projectId,
  canvas_id: canvasId,
  workspace_id: ids.ws,
  sort_order: sortOrder,
  added_at: T0,
  added_by: ids.someoneElse,
});

// ---- Model (slice 1a) ----

const ws = { workspace_id: ids.ws, ...standard };

export const concept = (id: string = ids.conceptCustomer, over: Partial<Concept> = {}): Concept => ({
  id,
  ...ws,
  name: id === ids.conceptCustomer ? "Customer" : "Sales",
  description_html: null,
  description_text: null,
  color: id === ids.conceptCustomer ? "#2F7DD1" : "#0F8B8D",
  sort_order: id === ids.conceptCustomer ? 0 : 1,
  ...over,
});

export const entity = (id: string = ids.customer, over: Partial<Entity> = {}): Entity => ({
  id,
  ...ws,
  concept_id: id === ids.customer ? ids.conceptCustomer : ids.conceptSales,
  name: id === ids.customer ? "Customer" : "Sales Order",
  stereotype: "object",
  definition_html: null,
  definition_text: null,
  ...over,
});

export const attribute = (id: string = ids.email, over: Partial<Attribute> = {}): Attribute => ({
  id,
  ...ws,
  entity_id: id === ids.orderId ? ids.salesOrder : ids.customer,
  name: id === ids.customerId ? "customer_id" : id === ids.orderId ? "order_id" : "email",
  sort_order: id === ids.email ? 1 : 0,
  data_type: id === ids.email ? "string" : "integer",
  custom_type: null,
  type_length: id === ids.email ? 100 : null,
  type_precision: null,
  type_scale: null,
  is_primary_key: id !== ids.email,
  is_foreign_key: false,
  is_business_key: false,
  is_pii: id === ids.email,
  is_nullable: id === ids.email,
  definition_html: null,
  definition_text: null,
  ...over,
});

export const relationship = (over: Partial<Relationship> = {}): Relationship => ({
  id: ids.relPlaces,
  ...ws,
  from_entity_id: ids.customer,
  to_entity_id: ids.salesOrder,
  label: "places",
  from_min: 1,
  from_max: "1",
  to_min: 0,
  to_max: "n",
  description: null,
  ...over,
});

export const sourceSystem = (over: Partial<SourceSystem> = {}): SourceSystem => ({
  id: ids.crm,
  ...ws,
  name: "CRM",
  description: null,
  ...over,
});

export const sourceTable = (over: Partial<SourceTable> = {}): SourceTable => ({
  id: ids.crmCustomer,
  ...ws,
  source_system_id: ids.crm,
  database_name: "crmprod",
  schema_name: "dbo",
  name: "customer",
  object_type: "table",
  row_count: null,
  comment: null,
  ...over,
});

export const sourceColumn = (id: string = ids.colEmail, over: Partial<SourceColumn> = {}): SourceColumn => ({
  id,
  ...ws,
  source_table_id: ids.crmCustomer,
  name: id === ids.colCustId ? "cust_id" : id === ids.colEmail ? "email" : "first_name",
  ordinal: id === ids.colCustId ? 1 : id === ids.colEmail ? 2 : 3,
  data_type: id === ids.colCustId ? "int" : "varchar",
  type_length: id === ids.colCustId ? null : id === ids.colEmail ? 100 : 50,
  type_precision: null,
  type_scale: null,
  is_nullable: id !== ids.colCustId,
  is_primary_key: id === ids.colCustId,
  is_foreign_key: false,
  is_business_key: id === ids.colCustId,
  is_pii: id !== ids.colCustId,
  default_value: null,
  comment: null,
  ...over,
});

export const mapping = (over: Partial<Mapping> = {}): Mapping => ({
  id: ids.mapEmail,
  ...ws,
  attribute_id: ids.email,
  kind: "direct",
  rule_expression: null,
  status: "draft",
  note_html: null,
  note_text: null,
  approved_by: null,
  approved_at: null,
  ...over,
});

export const mappingInput = (id: string = ids.inEmail, over: Partial<MappingInput> = {}): MappingInput => ({
  id,
  ...ws,
  mapping_id: ids.mapEmail,
  source_column_id: ids.colEmail,
  sort_order: 0,
  ...over,
});

export const canvasItem = (id: string = ids.itemCustomer, over: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  ...ws,
  canvas_id: ids.canvas1,
  entity_id: id === ids.itemCustomer ? ids.customer : null,
  source_table_id: id === ids.itemCrmCustomer ? ids.crmCustomer : null,
  requirement_id: null,
  x: 400,
  y: 120,
  width: null,
  collapsed: false,
  row_filter: "all",
  frame_id: null,
  live_level: null,
  ...over,
});

let eventCount = 0;
export const changeEvent = (over: Partial<ChangeEvent> = {}): ChangeEvent => ({
  id: `01900000-0000-7000-8000-e${String(++eventCount).padStart(11, "0")}`,
  workspace_id: ids.ws,
  change_group_id: ids.ws,
  occurred_at: T0,
  user_id: ids.someoneElse,
  object_type: "mapping",
  object_id: ids.mapEmail,
  operation: "update",
  before_image: null,
  after_image: null,
  context_label_id: null,
  ...over,
});
