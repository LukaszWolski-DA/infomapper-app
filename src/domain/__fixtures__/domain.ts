// Test fixtures for domain unit tests. Not used by application code.

import type { CommandContext } from "../changes";
import { BUILTIN_CLASSIFICATIONS, normClassification, type ClassificationCode } from "../model/classifications";
import type { WorkspaceAccess } from "../permissions";
import {
  DEFAULT_CANVAS_LOOK,
  type Attribute,
  type Canvas,
  type CanvasItem,
  type ChangeEvent,
  type Classification,
  type ClassificationLink,
  type Concept,
  type Entity,
  type Frame,
  type Label,
  type LabelLink,
  type Mapping,
  type MappingInput,
  type Note,
  type Organization,
  type OrganizationMember,
  type Project,
  type ProjectCanvas,
  type ProjectPinnedLabel,
  type Relationship,
  type Requirement,
  type RequirementLink,
  type SourceColumn,
  type SourceRelationship,
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
  // frames (slice 2b)
  frameA: "01900000-0000-7000-8000-00000000f001",
  frameB: "01900000-0000-7000-8000-00000000f002",
  // working layer (slice 3a)
  labelCr23: "01900000-0000-7000-8000-00000000a101",
  labelJira: "01900000-0000-7000-8000-00000000a102",
  linkCustomer: "01900000-0000-7000-8000-00000000a201",
  linkEmail: "01900000-0000-7000-8000-00000000a202",
  linkMapping: "01900000-0000-7000-8000-00000000a203",
  linkTable: "01900000-0000-7000-8000-00000000a204",
  noteFree: "01900000-0000-7000-8000-00000000d001",
  notePinned: "01900000-0000-7000-8000-00000000d002",
  // requirements (slice 4a)
  req101: "01900000-0000-7000-8000-00000000e101",
  req102: "01900000-0000-7000-8000-00000000e102",
  req103: "01900000-0000-7000-8000-00000000e103",
  req104: "01900000-0000-7000-8000-00000000e104",
  reqLink1: "01900000-0000-7000-8000-00000000e201",
  reqLink2: "01900000-0000-7000-8000-00000000e202",
  reqLink3: "01900000-0000-7000-8000-00000000e203",
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
  entity_names: null,
  attribute_names: null,
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
  alias: null,
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
  alias: null,
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
  copied_from_attribute_id: null,
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
  file_format: null,
  row_count: null,
  comment: null,
  missing_since: null, retired_since: null, note_html: null, note_text: null,
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
  default_value: null,
  comment: null,
  missing_since: null, retired_since: null, not_needed: false, note_html: null, note_text: null,
  ...over,
});

/** A foreign key between two source tables (slice 7a), from `from` (the table with the key) to `to`. */
export const sourceRelationship = (id: string, from: string, to: string, over: Partial<SourceRelationship> = {}): SourceRelationship => ({
  id,
  ...ws,
  source_table_id: from,
  to_source_table_id: to,
  name: `FK_${id.slice(-4)}`,
  kind: "declared",
  missing_since: null,
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
  review_reason: null,
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
  entity_names: null,
  attribute_names: null,
  ...over,
});

/** A free frame on canvas 1 at (0, 0), 800 × 600. */
export const frame = (id: string = ids.frameA, over: Partial<Frame> = {}): Frame => ({
  id,
  ...ws,
  canvas_id: ids.canvas1,
  name: "Area",
  kind: "free",
  concept_id: null,
  source_system_id: null,
  color: "#7C8998",
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  collapsed: false,
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

// ---- Working layer (slice 3a) ----

export const label = (id: string = ids.labelCr23, over: Partial<Label> = {}): Label => {
  const name = over.name ?? (id === ids.labelJira ? "JIRA-481" : "CR-23");
  return { id, ...ws, name, name_key: name.toLowerCase(), ...over };
};

/** A label link: CR-23 on Customer unless said otherwise. */
export const labelLink = (id: string = ids.linkCustomer, over: Partial<LabelLink> = {}): LabelLink => {
  const none = { entity_id: null, attribute_id: null, mapping_id: null, source_table_id: null, source_column_id: null };
  const target: Partial<LabelLink> =
    id === ids.linkEmail
      ? { attribute_id: ids.email }
      : id === ids.linkMapping
        ? { mapping_id: ids.mapEmail }
        : id === ids.linkTable
          ? { label_id: ids.labelJira, source_table_id: ids.crmCustomer }
          : { entity_id: ids.customer };
  return { id, ...ws, label_id: ids.labelCr23, ...none, ...target, ...over };
};

export const pin = (projectId: string = ids.projectA, labelId: string = ids.labelCr23): ProjectPinnedLabel => ({
  project_id: projectId,
  label_id: labelId,
  workspace_id: ids.ws,
});

/** A note on canvas 1: a free one at (1000, 900), or one pinned to the Customer card at offset (280, 0). */
export const note = (id: string = ids.noteFree, over: Partial<Note> = {}): Note => ({
  id,
  ...ws,
  canvas_id: ids.canvas1,
  body_html: "<p>Check the e-mail source</p>",
  body_text: "Check the e-mail source",
  color: "yellow",
  status: "open",
  resolved_at: null,
  resolved_by: null,
  width: 220,
  pin_canvas_item_id: id === ids.notePinned ? ids.itemCustomer : null,
  pin_frame_id: null,
  x: id === ids.notePinned ? 280 : 1000,
  y: id === ids.notePinned ? 0 : 900,
  frame_id: null,
  ...over,
});

// ---- Requirements (slice 4a) ----

const REQ_KEYS: Record<string, string> = { [ids.req101]: "REQ-101", [ids.req102]: "REQ-102", [ids.req103]: "REQ-103", [ids.req104]: "REQ-104" };

/** A Data requirement in Draft, its key from its id (REQ-101 to REQ-104). */
export const requirement = (id: string = ids.req101, over: Partial<Requirement> = {}): Requirement => ({
  id,
  ...ws,
  key: REQ_KEYS[id] ?? "REQ-199",
  kind: "data",
  name: "Contact data",
  description_html: null,
  description_text: null,
  expression: null,
  severity: null,
  status: "draft",
  priority: "should",
  owner_name: null,
  external_ref: null,
  parent_id: null,
  ...over,
});

/** A link of REQ-101 to the attribute email unless said otherwise. */
export const requirementLink = (id: string = ids.reqLink1, over: Partial<RequirementLink> = {}): RequirementLink => ({
  id,
  ...ws,
  requirement_id: ids.req101,
  entity_id: null,
  attribute_id: ids.email,
  mapping_id: null,
  source_table_id: null,
  source_column_id: null,
  ...over,
});

// ---- Classifications (slice 7c) ----

/** The workspace's 19 built-in classifications, ids `01900000-0000-7000-8000-c000000000NN` in the list's order. */
export const builtins = (): Classification[] =>
  BUILTIN_CLASSIFICATIONS.map((b, i) => ({
    id: `01900000-0000-7000-8000-c${String(i + 1).padStart(11, "0")}`,
    ...ws,
    code: b.code,
    name: b.name,
    name_key: normClassification(b.name),
    scope: b.scope,
    origin: b.origin,
  }));

/** One built-in classification of `builtins()` by its code. */
export const builtin = (code: ClassificationCode, over: Partial<Classification> = {}): Classification => ({ ...builtins().find((c) => c.code === code)!, ...over });

/** An own classification. */
export const ownClassification = (id: string, name: string, scope: Classification["scope"] = "column", over: Partial<Classification> = {}): Classification => ({
  id,
  ...ws,
  code: null,
  name,
  name_key: normClassification(name),
  scope,
  origin: "own",
  ...over,
});

let nextLinkId = 0;
/** A classification on a column (`{ columnId }`) or a table (`{ tableId }`); ids count up from `…-d1…`. */
export const classificationLink = (
  classification: Classification | ClassificationCode,
  target: { columnId: string } | { tableId: string },
  over: Partial<ClassificationLink> = {},
): ClassificationLink => ({
  id: `01900000-0000-7000-8000-d1${String(++nextLinkId).padStart(10, "0")}`,
  ...ws,
  classification_id: typeof classification === "string" ? builtin(classification).id : classification.id,
  source_table_id: "tableId" in target ? target.tableId : null,
  source_column_id: "columnId" in target ? target.columnId : null,
  ...over,
});

/** What the fixture columns' old flags said: cust_id a business key, email and first_name personal data. */
export const fixtureLinks = (): ClassificationLink[] => [
  classificationLink("BK", { columnId: ids.colCustId }),
  classificationLink("PII", { columnId: ids.colEmail }),
  classificationLink("PII", { columnId: ids.colFirstName }),
];
