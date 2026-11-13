// The editor's snapshot as the browser holds it (slice 26, D7 as Łukasz answered): what the document's sections read
// and nothing about people beyond what the app's pages show every member. The people keep their id and name (the
// author on the title page, `nameOf`); their e-mail addresses and last sign-in are blanked, and the member rows (roles)
// are left out, since no section reads them. The organization's row holds its name and versions only (its password is
// another table, `organization_access`, never in a snapshot).

import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";

export function browserSnapshot<T extends ModuleTable>(snapshot: WorkspaceSnapshot<T>): WorkspaceSnapshot<T> {
  return {
    ...snapshot,
    members: [],
    people: snapshot.people.map((p) => ({ id: p.id, display_name: p.display_name, email: "", created_at: p.created_at, last_seen_at: null })),
  };
}
