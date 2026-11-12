// The modules' tabs on the workspace home (slice 25, step 1's F10): each module's tab while it is shown, after
// Overview. InfoDocumenter's Documentation tab is the first (step 4): shown while InfoDocumenter is on, to every member.

import { getDataStore, type DataStore } from "@/data";
import { checkPermission, type WorkspaceAccess } from "@/domain/permissions";
import type { ModuleHomeTab } from "@/ui/home-tabs";
import { DocumentationTab, TAB_TEXTS } from "@/modules/infodocumenter/app/tab";
import { GONE_DOCUMENT, visibleDocuments } from "@/modules/infodocumenter/app/load";
import { createRefusal, RIGHTS_TEXTS } from "@/modules/infodocumenter/domain/rights";
import { STORE_SCHEMA } from "./tables";

/** A module's home tab: whether it is shown in the workspace, and the tab when it is. */
export interface HomeTabSource {
  readonly id: string;
  readonly shown: (access: WorkspaceAccess) => boolean;
  readonly tab: (store: DataStore, access: WorkspaceAccess) => Promise<ModuleHomeTab>;
}

/** InfoDocumenter's Documentation tab: the documents the person sees, counted in its label. */
const DOCUMENTATION: HomeTabSource = {
  id: "docs",
  shown: (access) => access.workspace.infodoc && access.member !== null,
  async tab(store, access) {
    const documents = await visibleDocuments(store, access);
    return {
      id: "docs",
      label: TAB_TEXTS.label(documents.length),
      body: () => (
        <DocumentationTab
          workspaceId={access.workspace.id}
          language={access.workspace.doc_language}
          documents={documents}
          canCreate={createRefusal(access) === null}
          canShare={checkPermission(access, "model.edit") === null && checkPermission(access, "module.own_objects") === null}
        />
      ),
    };
  },
};

/**
 * What the home says when a module's page sent the person back (`?gone=`, step 4b): a document they can no longer open.
 */
export const HOME_GONE: Readonly<Record<string, string>> = { [GONE_DOCUMENT]: RIGHTS_TEXTS.gone };

/** Every module's home tab, in order. */
export const HOME_TABS: readonly HomeTabSource[] = [DOCUMENTATION];

/** The tabs shown on this workspace's home for this person; the composed store reads the modules' tables. */
export async function homeTabs(access: WorkspaceAccess, sources: readonly HomeTabSource[] = HOME_TABS, store: DataStore = getDataStore(STORE_SCHEMA)): Promise<ModuleHomeTab[]> {
  return Promise.all(sources.filter((s) => s.shown(access)).map((s) => s.tab(store, access)));
}
