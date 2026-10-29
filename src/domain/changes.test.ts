import { describe, expect, it } from "vitest";
import { ids, makeCtx, member, T0 } from "./__fixtures__/domain";
import { buildWriteSet, SECRET_CHANGED, SECRET_UNCHANGED, writtenVersions } from "./changes";
import type { OrganizationAccess } from "./types";

const access: OrganizationAccess = { organization_id: ids.org, access_hash: "scrypt$15$8$1$a$b", changed_at: T0, changed_by: ids.actor, version: 1 };

describe("buildWriteSet: secret columns (slice 8, item 15, Q4)", () => {
  it("writes a marker instead of the hash into both images, and the hash into the row", () => {
    const row = { ...access, access_hash: "scrypt$15$8$1$c$d", version: 2 };
    const ws = buildWriteSet(makeCtx(), ids.ws, [{ kind: "update", table: "organization_access", before: access, row }]);
    expect(ws.writes[0]).toMatchObject({ row: { access_hash: "scrypt$15$8$1$c$d" } });
    expect(ws.events[0]!.before_image).toEqual({ ...access, access_hash: SECRET_CHANGED });
    expect(ws.events[0]!.after_image).toEqual({ ...row, access_hash: SECRET_CHANGED });
    expect(JSON.stringify(ws.events)).not.toMatch(/scrypt\$/);
  });

  it("says when the hash did not change, and marks a new row's hash as changed", () => {
    const same = buildWriteSet(makeCtx(), ids.ws, [{ kind: "update", table: "organization_access", before: access, row: { ...access, version: 2 } }]);
    expect(same.events[0]!.after_image?.access_hash).toBe(SECRET_UNCHANGED);
    const created = buildWriteSet(makeCtx(), ids.ws, [{ kind: "insert", table: "organization_access", row: access }]);
    expect(created.events[0]).toMatchObject({ object_id: ids.org, before_image: null, after_image: { access_hash: SECRET_CHANGED } });
  });

  it("leaves the row it was given untouched", () => {
    const row = { ...access };
    buildWriteSet(makeCtx(), ids.ws, [{ kind: "insert", table: "organization_access", row }]);
    expect(row.access_hash).toBe(access.access_hash);
  });
});

describe("buildWriteSet: membership rows (slice 8, F4)", () => {
  it("names the person as the object, and a removal has no after image", () => {
    const removed = buildWriteSet(makeCtx(), ids.ws, [
      { kind: "remove", table: "workspace_member", before: member("modeler", { user_id: ids.someoneElse }) },
      { kind: "remove", table: "organization_member", before: { organization_id: ids.org, user_id: ids.someoneElse, role: "member", created_at: T0 } },
    ]);
    for (const e of removed.events) expect(e).toMatchObject({ object_id: ids.someoneElse, operation: "delete", after_image: null });
  });
});

describe("writtenVersions (slice 9 undo; slice 10a, F2)", () => {
  it("gives each written row's new version by id, inserts and updates alike; removed links and rows without an id are left out", () => {
    const writes = [
      { kind: "update", table: "entity", before: { id: "e1", version: 3 }, row: { id: "e1", version: 4 } },
      { kind: "insert", table: "relationship", row: { id: "r1", version: 1 } },
      { kind: "remove", table: "project_canvas", before: { project_id: "p", canvas_id: "c" } },
      { kind: "update", table: "organization_access", before: access, row: { ...access, version: 2 } },
    ] as unknown as Parameters<typeof writtenVersions>[0];
    expect(writtenVersions(writes)).toEqual({ e1: 4, r1: 1 });
  });
});
