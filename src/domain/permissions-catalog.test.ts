// "May read the catalog" (slice 39, A1.2 guardrail 2, S39-02): one rule over stored rows, nothing stored for it.

import { describe, expect, it } from "vitest";
import { archived, ids, member, organization, organizationMember, T0, workspace } from "./__fixtures__/domain";
import { catalogReadable, opensCatalog, type CatalogRightsInput } from "./permissions";
import type { OrganizationLicence } from "./types";

const WS2 = "01900000-0000-7000-8000-000000000011";
const WS3 = "01900000-0000-7000-8000-000000000012";
const OTHER_WS = "01900000-0000-7000-8000-000000000013";
const licence = (over: Partial<OrganizationLicence> = {}): OrganizationLicence => ({
  id: "01900000-0000-7000-8000-000000000900",
  organization_id: ids.org,
  module: "infocatalog",
  version: 1,
  created_at: T0,
  created_by: ids.someoneElse,
  updated_at: T0,
  updated_by: ids.someoneElse,
  deleted_at: null,
  ...over,
});

/** InfoMate with three workspaces: the actor has a role in the first; the second is shown; the third is not. */
const base = (over: Partial<CatalogRightsInput> = {}): CatalogRightsInput => ({
  userId: ids.actor,
  unlocked: new Set([ids.org, ids.otherOrg]),
  organizations: [organization(), organization({ id: ids.otherOrg, name: "Retail Co" })],
  memberships: [organizationMember()],
  licences: [licence()],
  workspaces: [
    workspace({ name: "B mine" }),
    workspace({ id: WS2, name: "A shown", catalog_shown: true }),
    workspace({ id: WS3, name: "C hidden" }),
    workspace({ id: OTHER_WS, organization_id: ids.otherOrg, name: "Retail's", catalog_shown: true }),
  ],
  workspaceMembers: [member("reader")],
  ...over,
});
const names = (input: CatalogRightsInput) => catalogReadable(input).map((o) => [o.name, o.workspaces.map((w) => `${w.name}${w.hasRole ? " (role)" : ""}${w.archived ? " (archived)" : ""}`)]);

describe("catalogReadable", () => {
  it("gives a member the workspaces with a role (any) and the shown ones, by name; never a hidden one", () => {
    expect(names(base())).toEqual([["InfoMate", ["A shown", "B mine (role)"]]]);
    expect(names(base({ workspaceMembers: [] }))).toEqual([["InfoMate", ["A shown"]]]);
  });

  it("follows the switch: off then on", () => {
    const off = base({ workspaces: [workspace({ id: WS3, name: "C", catalog_shown: false })], workspaceMembers: [] });
    expect(names(off)).toEqual([["InfoMate", []]]);
    const on = base({ workspaces: [workspace({ id: WS3, name: "C", catalog_shown: true })], workspaceMembers: [] });
    expect(names(on)).toEqual([["InfoMate", ["C"]]]);
  });

  it("gives a guest nothing of the organization, even with a role in one of its workspaces", () => {
    expect(names(base({ memberships: [] }))).toEqual([]);
    // a membership of another organization does not count for this one
    expect(names(base({ memberships: [organizationMember({ organization_id: ids.otherOrg })] }))).toEqual([]);
  });

  it("needs the organization's live licence, and an unlocked organization", () => {
    expect(names(base({ licences: [] }))).toEqual([]);
    expect(names(base({ licences: [licence({ deleted_at: T0 })] }))).toEqual([]);
    expect(names(base({ licences: [licence({ module: "infodoc" })] }))).toEqual([]);
    expect(names(base({ unlocked: new Set([ids.otherOrg]) }))).toEqual([]);
  });

  it("keeps archived workspaces, marked, under the same rule; never a deleted workspace or organization", () => {
    expect(names(base({ workspaces: [workspace({ ...archived, name: "Old" }), workspace({ id: WS3, name: "Old hidden", ...archived })] }))).toEqual([["InfoMate", ["Old (role) (archived)"]]]);
    expect(names(base({ workspaces: [workspace({ deleted_at: T0 })] }))).toEqual([["InfoMate", []]]);
    expect(names(base({ organizations: [organization({ deleted_at: T0 })] }))).toEqual([]);
  });

  it("gives an organization's owner or admin without a role only the shown workspaces", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(names(base({ memberships: [organizationMember({ role })], workspaceMembers: [] }))).toEqual([["InfoMate", ["A shown"]]]);
    }
  });

  it("lists several licensed organizations by name, with InfoCube's switch and the role", () => {
    const two = base({
      memberships: [organizationMember(), organizationMember({ organization_id: ids.otherOrg })],
      licences: [licence(), licence({ id: "01900000-0000-7000-8000-000000000901", organization_id: ids.otherOrg })],
      workspaces: [workspace({ infocube: true }), workspace({ id: OTHER_WS, organization_id: ids.otherOrg, name: "Retail's", catalog_shown: true })],
    });
    const out = catalogReadable(two);
    expect(out.map((o) => o.name)).toEqual(["InfoMate", "Retail Co"]);
    expect(out[0]!.workspaces[0]).toEqual({ id: ids.ws, organizationId: ids.org, name: "Retail Co – DWH", archived: false, infocube: true, hasRole: true });
    expect(out[1]!.workspaces[0]!.hasRole).toBe(false);
  });
});

describe("opensCatalog (the top bar's All apps, S39-01)", () => {
  it("needs the organization unlocked, licensed and the person its member; workspaces play no part", () => {
    expect(opensCatalog(ids.org, base())).toBe(true);
    expect(opensCatalog(ids.org, base({ workspaces: [], workspaceMembers: [] }))).toBe(true);
    expect(opensCatalog(ids.org, base({ memberships: [] }))).toBe(false);
    expect(opensCatalog(ids.org, base({ licences: [] }))).toBe(false);
    expect(opensCatalog(ids.org, base({ unlocked: new Set() }))).toBe(false);
    expect(opensCatalog(ids.otherOrg, base())).toBe(false);
  });
});
