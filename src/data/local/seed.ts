// Demo data for development and end-to-end tests. Mirrors the prototype (slice 0 PRD, step 3).

import { uuidv7, type Uuid } from "@/domain/ids";
import {
  DEFAULT_CANVAS_LOOK,
  type AppUser,
  type Canvas,
  type DocLanguage,
  type Project,
  type WorkspaceRole,
} from "@/domain/types";
import { emptyDb, findViolation, type DevDb } from "./schema";

export const SEED_USERS = {
  lukasz: { email: "lukasz@infomate.pl", display_name: "Łukasz" },
  anna: { email: "anna.nowak@infomate.pl", display_name: "Anna Nowak" },
  piotr: { email: "piotr.w@infomate.pl", display_name: "Piotr Wiśniewski" },
  kasia: { email: "k.zielinska@retailco.com", display_name: "Kasia Zielińska" },
  marek: { email: "m.lis@retailco.com", display_name: "Marek Lis" },
} as const;
type SeedUser = keyof typeof SEED_USERS;

export function buildSeed(now: Date = new Date()): DevDb {
  const db = emptyDb();
  const at = now.toISOString();
  const users = {} as Record<SeedUser, AppUser>;
  for (const [handle, u] of Object.entries(SEED_USERS) as [SeedUser, (typeof SEED_USERS)[SeedUser]][]) {
    users[handle] = { id: uuidv7(), ...u, created_at: at, last_seen_at: null };
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

  const organization = (name: string, members: SeedUser[]) => {
    const org = { id: uuidv7(), name, ...audit("lukasz") };
    db.organization.push(org);
    for (const m of members) {
      db.organization_member.push({ organization_id: org.id, user_id: users[m].id, role: "member", created_at: at });
    }
    return org;
  };

  const workspace = (
    organizationId: Uuid,
    by: SeedUser,
    w: { name: string; client: string; description: string; lang: DocLanguage; dv2?: boolean; fourEyes?: boolean; archived?: boolean },
    members: [SeedUser, WorkspaceRole][],
  ) => {
    const ws = {
      id: uuidv7(),
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

  const project = (workspaceId: Uuid, by: SeedUser, name: string, description: string | null = null): Project => {
    const p = { id: uuidv7(), workspace_id: workspaceId, name, description, ...audit(by) };
    db.project.push(p);
    return p;
  };

  const canvas = (workspaceId: Uuid, by: SeedUser, name: string, projects: Project[]): Canvas => {
    const c = { id: uuidv7(), workspace_id: workspaceId, name, live_label_id: null, look: { ...DEFAULT_CANVAS_LOOK }, ...audit(by) };
    db.canvas.push(c);
    for (const p of projects) {
      const sort_order = db.project_canvas.filter((l) => l.project_id === p.id).length;
      db.project_canvas.push({ project_id: p.id, canvas_id: c.id, workspace_id: workspaceId, sort_order, added_at: at, added_by: users[by].id });
    }
    return c;
  };

  const infomate = organization("InfoMate", ["lukasz", "anna", "piotr"]);
  const retailCo = organization("Retail Co", ["kasia", "marek"]);

  const retailDwh = workspace(
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
  const c360 = project(retailDwh.id, "lukasz", "Customer 360", "One view of the customer across CRM and the web shop.");
  const orders = project(retailDwh.id, "lukasz", "Order management", "Orders, order lines and products from ERP.");
  canvas(retailDwh.id, "lukasz", "Customer & orders", [c360, orders]);
  canvas(retailDwh.id, "lukasz", "Order lines & products", [orders]);

  const bankX = workspace(
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
  canvas(bankX.id, "lukasz", "First canvas", [project(bankX.id, "lukasz", "First project")]);

  const sales = workspace(
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
  canvas(sales.id, "marek", "First canvas", [project(sales.id, "marek", "First project")]);

  const violation = findViolation(db);
  if (violation) throw new Error(`Seed data breaks a rule: ${violation.table}: ${violation.detail}`);
  return db;
}
