// Demo data for development and end-to-end tests. Mirrors the prototype (slice 0 PRD, step 3; slice 1a PRD, demo data).

import type { Uuid } from "@/domain/ids";
import {
  DEFAULT_CANVAS_LOOK,
  type AppUser,
  type Canvas,
  type DocLanguage,
  type OrganizationRole,
  type Project,
  type WorkspaceRole,
} from "@/domain/types";
import { emptyDb, findViolation, type DevDb } from "./schema";
import { addDemoModel, DEMO_LAYOUT } from "./seed-model";

/**
 * Fixed UUID v7 ids for the seed rows, so they stay the same after "npm run reset-dev-data".
 * Rows created while using the app get generated ids.
 */
export const SEED_IDS = {
  userLukasz: "01a0f9e9-2000-7588-bf2c-d0927cb58233",
  userAnna: "01a0f9e9-2001-7440-a31a-c54ff51efa06",
  userPiotr: "01a0f9e9-2002-7780-a11e-3695b38a7e6d",
  userKasia: "01a0f9e9-2003-74a8-9a58-543e0bf03e82",
  userMarek: "01a0f9e9-2004-7578-9ad5-25dcfabbf0a4",
  orgInfoMate: "01a0f9e9-2005-7250-af23-ab4f2c3611c5",
  orgRetailCo: "01a0f9e9-2006-7178-8cdf-249f50cfcf87",
  wsRetailDwh: "01a0f9e9-2007-7148-89de-52f53405ecb8",
  wsBankX: "01a0f9e9-2008-7368-adae-f7872a1090a9",
  wsSales: "01a0f9e9-2009-7078-b8aa-c0fce61fd49f",
  projCustomer360: "01a0f9e9-200a-75e0-914a-30a0f6049ccd",
  projOrderManagement: "01a0f9e9-200b-72a8-81ce-88743c8c4c61",
  projBankFirst: "01a0f9e9-200c-7628-b70e-751e9764d33a",
  projSalesFirst: "01a0f9e9-200d-70f0-ab8c-33959cb22ad8",
  canvasCustomerOrders: "01a0f9e9-200e-76a0-bc7b-08c5483e9b28",
  canvasOrderLines: "01a0f9e9-200f-77a0-a20c-772adf9653ee",
  canvasBankFirst: "01a0f9e9-2010-73f0-80d4-7d03a11d2054",
  canvasSalesFirst: "01a0f9e9-2011-7448-b5b1-e49ea5c1e456",
} as const;

export const SEED_USERS = {
  lukasz: { id: SEED_IDS.userLukasz, email: "lukasz@infomate.pl", display_name: "Łukasz" },
  anna: { id: SEED_IDS.userAnna, email: "anna.nowak@infomate.pl", display_name: "Anna Nowak" },
  piotr: { id: SEED_IDS.userPiotr, email: "piotr.w@infomate.pl", display_name: "Piotr Wiśniewski" },
  kasia: { id: SEED_IDS.userKasia, email: "k.zielinska@retailco.com", display_name: "Kasia Zielińska" },
  marek: { id: SEED_IDS.userMarek, email: "m.lis@retailco.com", display_name: "Marek Lis" },
} as const;
type SeedUser = keyof typeof SEED_USERS;

export function buildSeed(now: Date = new Date()): DevDb {
  const db = emptyDb();
  const at = now.toISOString();
  const users = {} as Record<SeedUser, AppUser>;
  for (const [handle, u] of Object.entries(SEED_USERS) as [SeedUser, (typeof SEED_USERS)[SeedUser]][]) {
    users[handle] = { ...u, created_at: at, last_seen_at: null };
    db.app_user.push(users[handle]);
  }

  const audit = (by: SeedUser) => ({
    version: 1,
    created_at: at,
    created_by: users[by].id,
    updated_at: at,
    updated_by: users[by].id,
    deleted_at: null,
  });

  const organization = (id: Uuid, name: string, members: [SeedUser, OrganizationRole][]) => {
    const org = { id, name, ...audit("lukasz") };
    db.organization.push(org);
    for (const [m, role] of members) {
      db.organization_member.push({ organization_id: org.id, user_id: users[m].id, role, created_at: at });
    }
    return org;
  };

  const workspace = (
    id: Uuid,
    organizationId: Uuid,
    by: SeedUser,
    w: { name: string; client: string; description: string; lang: DocLanguage; dv2?: boolean; fourEyes?: boolean; archived?: boolean },
    members: [SeedUser, WorkspaceRole][],
  ) => {
    const ws = {
      id,
      organization_id: organizationId,
      name: w.name,
      client_name: w.client,
      description: w.description,
      doc_language: w.lang,
      dv2_mode: w.dv2 ?? false,
      four_eyes: w.fourEyes ?? false,
      archived_at: w.archived ? at : null,
      archived_by: w.archived ? users[by].id : null,
      requirement_key_next: 101,
      ...audit(by),
    };
    db.workspace.push(ws);
    for (const [m, role] of members) {
      db.workspace_member.push({ workspace_id: ws.id, user_id: users[m].id, role, added_by: users[by].id, created_at: at });
    }
    return ws;
  };

  const project = (id: Uuid, workspaceId: Uuid, by: SeedUser, name: string, description: string | null = null): Project => {
    const p = { id, workspace_id: workspaceId, name, description, ...audit(by) };
    db.project.push(p);
    return p;
  };

  const canvas = (id: Uuid, workspaceId: Uuid, by: SeedUser, name: string, projects: Project[]): Canvas => {
    const c = { id, workspace_id: workspaceId, name, live_label_id: null, look: { ...DEFAULT_CANVAS_LOOK }, ...audit(by) };
    db.canvas.push(c);
    for (const p of projects) {
      const sort_order = db.project_canvas.filter((l) => l.project_id === p.id).length;
      db.project_canvas.push({ project_id: p.id, canvas_id: c.id, workspace_id: workspaceId, sort_order, added_at: at, added_by: users[by].id });
    }
    return c;
  };

  const infomate = organization(SEED_IDS.orgInfoMate, "InfoMate", [["lukasz", "owner"], ["anna", "member"], ["piotr", "member"]]);
  const retailCo = organization(SEED_IDS.orgRetailCo, "Retail Co", [["kasia", "member"], ["marek", "owner"]]);

  const retailDwh = workspace(
    SEED_IDS.wsRetailDwh,
    infomate.id,
    "lukasz",
    {
      name: "Retail Co – DWH",
      client: "Retail Co",
      description: "Enterprise data warehouse for Retail Co: customers, orders and products from CRM, web shop and ERP.",
      lang: "en",
    },
    [["lukasz", "owner"], ["anna", "modeler"], ["piotr", "reviewer"], ["kasia", "reader"]],
  );
  const c360 = project(SEED_IDS.projCustomer360, retailDwh.id, "lukasz", "Customer 360", "One view of the customer across CRM and the web shop.");
  const orders = project(SEED_IDS.projOrderManagement, retailDwh.id, "lukasz", "Order management", "Orders, order lines and products from ERP.");
  canvas(SEED_IDS.canvasCustomerOrders, retailDwh.id, "lukasz", "Customer & orders", [c360, orders]);
  canvas(SEED_IDS.canvasOrderLines, retailDwh.id, "lukasz", "Order lines & products", [orders]);
  addDemoModel(db, {
    workspaceId: retailDwh.id,
    at,
    authorId: users.anna.id,
    approverId: users.piotr.id,
    canvases: [
      { canvasId: SEED_IDS.canvasCustomerOrders, layout: DEMO_LAYOUT.customerOrders },
      { canvasId: SEED_IDS.canvasOrderLines, layout: DEMO_LAYOUT.orderLines },
    ],
  });

  const bankX = workspace(
    SEED_IDS.wsBankX,
    infomate.id,
    "lukasz",
    {
      name: "Bank X – Risk DWH",
      client: "Bank X",
      description: "Credit risk data mart. Project closed in August 2026; kept for reference.",
      lang: "en",
      dv2: true,
      fourEyes: true,
      archived: true,
    },
    [["lukasz", "owner"], ["anna", "modeler"]],
  );
  const bankProject = project(SEED_IDS.projBankFirst, bankX.id, "lukasz", "First project");
  canvas(SEED_IDS.canvasBankFirst, bankX.id, "lukasz", "First canvas", [bankProject]);

  const sales = workspace(
    SEED_IDS.wsSales,
    retailCo.id,
    "marek",
    {
      name: "Sales analytics",
      client: "Retail Co",
      description: "Retail Co's own workspace. InfoMate is invited as a guest reviewer.",
      lang: "pl",
      fourEyes: true,
    },
    [["marek", "owner"], ["lukasz", "reviewer"]],
  );
  const salesProject = project(SEED_IDS.projSalesFirst, sales.id, "marek", "First project");
  canvas(SEED_IDS.canvasSalesFirst, sales.id, "marek", "First canvas", [salesProject]);
  // The same model; its canvas shows the cards of “Customer & orders”. Four-eyes is on here, so Marek authored and
  // Łukasz approved.
  addDemoModel(db, {
    workspaceId: sales.id,
    at,
    authorId: users.marek.id,
    approverId: users.lukasz.id,
    canvases: [{ canvasId: SEED_IDS.canvasSalesFirst, layout: DEMO_LAYOUT.customerOrders }],
  });

  const violation = findViolation(db);
  if (violation) throw new Error(`Seed data breaks a rule: ${violation.table}: ${violation.detail}`);
  return db;
}
