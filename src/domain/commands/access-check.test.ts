import { describe, expect, it } from "vitest";
import { accessChangedRefusal, type CheckedAccess } from "./access-check";

const checked: CheckedAccess = { userId: "u", workspace: { id: "w", name: "Retail", archived: false, role: "modeler" } };

describe("the access read again inside the write (slice 30, B3, L1)", () => {
  it("passes when nothing changed", () => {
    expect(accessChangedRefusal(checked, { workspace: { archived: false, role: "modeler" } })).toBeNull();
  });

  it("refuses any change of the role, a promotion too, and a removal", () => {
    for (const role of ["reader", "admin", null]) {
      expect(accessChangedRefusal(checked, { workspace: { archived: false, role } })).toEqual({
        code: "forbidden",
        message: "Your role in Retail changed meanwhile, so nothing was saved.",
      });
    }
  });

  it("refuses a workspace archived meanwhile with the archive's refusal, and an unarchived one as stale", () => {
    expect(accessChangedRefusal(checked, { workspace: { archived: true, role: "modeler" } })?.code).toBe("archived");
    const archived: CheckedAccess = { ...checked, workspace: { ...checked.workspace!, archived: true } };
    expect(accessChangedRefusal(archived, { workspace: { archived: false, role: "modeler" } })?.code).toBe("stale_version");
  });

  it("refuses a workspace gone meanwhile as not found", () => {
    expect(accessChangedRefusal(checked, { workspace: null })?.code).toBe("not_found");
  });

  it("compares the organization role when the command read it (a workspace's create)", () => {
    const org: CheckedAccess = { userId: "u", organization: { id: "o", name: "InfoMate", role: "member" } };
    expect(accessChangedRefusal(org, { organization: { role: "member" } })).toBeNull();
    expect(accessChangedRefusal(org, { organization: { role: null } })?.message).toBe("Your role in InfoMate changed meanwhile, so nothing was saved.");
  });

  it("compares nothing the command did not read", () => {
    expect(accessChangedRefusal({ userId: "u" }, { workspace: { archived: true, role: null } })).toBeNull();
  });
});
