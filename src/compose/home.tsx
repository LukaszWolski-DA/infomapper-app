// The modules' tabs on the workspace home (slice 25, step 1's F10): each module's tab while it is shown, after
// Overview. InfoDocumenter's Documentation tab comes with the interface (slice 25, step 4); until then no module has one,
// and the home shows its own tabs only.

import { getDataStore, type DataStore } from "@/data";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { ModuleHomeTab } from "@/ui/home-tabs";
import { STORE_SCHEMA } from "./tables";

/** A module's home tab: whether it is shown in the workspace, and the tab when it is. */
export interface HomeTabSource {
  readonly id: string;
  readonly shown: (access: WorkspaceAccess) => boolean;
  readonly tab: (store: DataStore, access: WorkspaceAccess) => Promise<ModuleHomeTab>;
}

/** Every module's home tab, in order. */
export const HOME_TABS: readonly HomeTabSource[] = [];

/** The tabs shown on this workspace's home for this person; the composed store reads the modules' tables. */
export async function homeTabs(access: WorkspaceAccess, sources: readonly HomeTabSource[] = HOME_TABS, store: DataStore = getDataStore(STORE_SCHEMA)): Promise<ModuleHomeTab[]> {
  return Promise.all(sources.filter((s) => s.shown(access)).map((s) => s.tab(store, access)));
}
