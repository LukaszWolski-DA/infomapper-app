// The demo requirements (slice 4a, PRD item 15): the prototype's five requirements and their links in “Retail Co –
// DWH”, on the model that `addDemoModel` seeds, matched by name. Descriptions are the prototype's, one paragraph each.
// No requirement has a card on a canvas yet (the prototype's REQ-104 card comes with slice 4b). The workspace's key
// counter is set to 106 by the caller.

import type { Uuid } from "@/domain/ids";
import { cardHeightFor } from "@/domain/model/card-size";
import { DEFAULT_CARD_WIDTH } from "@/domain/model/frames";
import { targetColumns, type LabelTarget } from "@/domain/model/labels";
import { notePlaces, notePosition } from "@/domain/model/notes";
import { requirementCardSpots } from "@/domain/model/requirement-placement";
import { plainTextPair } from "@/domain/model/plain-text";
import type { CanvasItem, Requirement, RequirementLink } from "@/domain/types";
import type { DevDb } from "./schema";
import { seedId } from "./seed-model";

export const DEMO_REQUIREMENT_KEY_NEXT = 106;

export interface DemoRequirementsOptions {
  workspaceId: Uuid;
  at: string;
  /** Who wrote them (a modeler). */
  authorId: Uuid;
}

type Demo = Pick<Requirement, "key" | "kind" | "name" | "status" | "priority" | "owner_name" | "external_ref"> & {
  parent?: string;
  description: string;
  expression?: string;
  severity?: "warn";
  links: string[];
};

const DEMO: Demo[] = [
  {
    key: "REQ-101",
    kind: "need",
    name: "Single view of the customer",
    description: "Marketing and service need one trusted customer record across CRM and the web shop.",
    status: "agreed",
    priority: "must",
    owner_name: "Head of CRM",
    external_ref: null,
    links: ["entity:customer"],
  },
  {
    key: "REQ-102",
    kind: "data",
    parent: "REQ-101",
    name: "Contact data for every active customer",
    description: "First name, last name and e-mail are available for every active customer.",
    status: "agreed",
    priority: "must",
    owner_name: "Data owner CRM",
    external_ref: null,
    links: ["attribute:customer.first_name", "attribute:customer.last_name", "attribute:customer.email"],
  },
  {
    key: "REQ-103",
    kind: "dq_rule",
    parent: "REQ-102",
    name: "E-mail is unique per customer",
    description: "No two active customers share an e-mail address.",
    expression: "COUNT(DISTINCT customer_id) per lower(email) = 1",
    severity: "warn",
    status: "draft",
    priority: "should",
    owner_name: "Data steward",
    external_ref: null,
    links: ["attribute:customer.email"],
  },
  {
    key: "REQ-104",
    kind: "business_rule",
    name: "Order total equals the sum of its lines",
    description: "Total amount = sum over lines of quantity × unit price × (1 − discount).",
    expression: "total_amount = SUM(quantity * unit_price * (1 - discount_pct / 100))",
    status: "draft",
    priority: "must",
    owner_name: "Finance controller",
    external_ref: "JIRA-481",
    links: ["attribute:order.total_amount", "attribute:line.quantity", "attribute:line.unit_price", "attribute:line.discount_pct"],
  },
  {
    key: "REQ-105",
    kind: "non_functional",
    name: "Personal data is encrypted at rest",
    description: "All PII attributes are encrypted in storage and masked outside production.",
    status: "agreed",
    priority: "must",
    owner_name: "DPO",
    external_ref: "GDPR",
    links: ["attribute:customer.first_name", "attribute:customer.last_name", "attribute:customer.email", "attribute:customer.birth_date"],
  },
];

export function addDemoRequirements(db: DevDb, o: DemoRequirementsOptions): void {
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
  for (const r of DEMO) {
    const description = plainTextPair(r.description);
    const requirement: Requirement = {
      ...std(`requirement:${r.key}`),
      key: r.key,
      kind: r.kind,
      name: r.name,
      description_html: description.html,
      description_text: description.text,
      expression: r.expression ?? null,
      severity: r.severity ?? null,
      status: r.status,
      priority: r.priority,
      owner_name: r.owner_name,
      external_ref: r.external_ref,
      parent_id: r.parent ? id(`requirement:${r.parent}`) : null,
    };
    db.requirement.push(requirement);
    for (const link of r.links) {
      const [kind, key] = link.split(":") as ["entity" | "attribute", string];
      const target: LabelTarget = { kind, id: id(`${kind}:${key}`) };
      const row: RequirementLink = { ...std(`requirement_link:${r.key}>${link}`), requirement_id: requirement.id, ...targetColumns(target) };
      db.requirement_link.push(row);
    }
  }
}

/** A requirement card's height for placing it before it is drawn: two name lines (the canvas measures the name). */
const SEED_CARD_HEIGHT = 111;

/**
 * REQ-104's card on “Customer & orders” (slice 4b-2, PRD item 25, prototype placeSeedReq): next to the Sales concept's
 * cards, where the prototype's Sales frame would put it (the demo seed has no frames), by the placing rule of item 15:
 * 80 px right of their box, at its top + 40, then down to the first free place.
 */
export function addDemoRequirementCard(db: DevDb, o: { workspaceId: Uuid; canvasId: Uuid; at: string; authorId: Uuid }): void {
  const id = (key: string) => seedId(o.workspaceId, key);
  const items = db.canvas_item.filter((i) => i.canvas_id === o.canvasId && i.deleted_at === null);
  const salesConcept = id("concept:sales");
  const rowsOf = (i: CanvasItem) =>
    i.entity_id ? db.attribute.filter((a) => a.entity_id === i.entity_id).length : db.source_column.filter((c) => c.source_table_id === i.source_table_id).length;
  const box = (i: CanvasItem) => ({ x: i.x, y: i.y, w: i.width ?? DEFAULT_CARD_WIDTH, h: cardHeightFor(rowsOf(i)) });
  const sales = items.filter((i) => i.entity_id && db.entity.find((e) => e.id === i.entity_id)?.concept_id === salesConcept).map(box);
  const x0 = Math.min(...sales.map((b) => b.x)), y0 = Math.min(...sales.map((b) => b.y));
  const anchor = { x: x0, y: y0 + 40, w: Math.max(...sales.map((b) => b.x + b.w)) - x0, h: 0 };
  const places = notePlaces(items, db.frame.filter((f) => f.canvas_id === o.canvasId && f.deleted_at === null));
  const occupied = [
    ...items.map(box),
    // notes where they are drawn (a pinned one at its card's corner plus its offset), about 120 px high
    ...db.note
      .filter((n) => n.canvas_id === o.canvasId && n.deleted_at === null)
      .map((n) => ({ ...notePosition(n, places), w: n.width, h: 120 })),
  ];
  const [spot] = requirementCardSpots(anchor, anchor, [SEED_CARD_HEIGHT], occupied);
  db.canvas_item.push({
    id: id("canvas_item:REQ-104"),
    workspace_id: o.workspaceId,
    version: 1,
    created_at: o.at,
    created_by: o.authorId,
    updated_at: o.at,
    updated_by: o.authorId,
    deleted_at: null,
    canvas_id: o.canvasId,
    entity_id: null,
    source_table_id: null,
    requirement_id: id("requirement:REQ-104"),
    x: spot!.x,
    y: spot!.y,
    width: null,
    collapsed: false,
    row_filter: "all",
    frame_id: null,
    live_level: null,
  });
}
