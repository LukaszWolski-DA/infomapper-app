// The modules' boxes in the workspace settings (slice 15a, E4, O2): InfoCube's, then InfoDocumenter's below it
// (slice 25, F11), always shown.

import { getDataStore, type DataStore } from "@/data";
import { can, type WorkspaceAccess } from "@/domain/permissions";
import { InfoCubeBox } from "@/modules/infocube/app/infocube-box";
import { InfoDocumenterBox } from "@/modules/infodocumenter/app/settings-box";
import { STORE_SCHEMA } from "./tables";

export async function settingsBoxes(store: DataStore, access: WorkspaceAccess) {
  const { workspace } = access;
  const [organization, licences, documents] = await Promise.all([
    store.organizations.get(workspace.organization_id),
    store.organizations.listLicences(workspace.organization_id),
    // the default store knows InfoMapper's tables only: a module's table is read through the composed one
    getDataStore(STORE_SCHEMA).modules.list(workspace.id, "document_definition"),
  ]);
  const canSwitch = can(access, "workspace.edit_settings");
  const organizationName = organization?.name ?? "";
  return (
    <>
      <InfoCubeBox
        workspaceId={workspace.id}
        version={workspace.version}
        on={workspace.infocube}
        licensed={licences.some((l) => l.module === "infocube")}
        organizationName={organizationName}
        canSwitch={canSwitch}
      />
      <InfoDocumenterBox
        workspaceId={workspace.id}
        version={workspace.version}
        on={workspace.infodoc}
        licensed={licences.some((l) => l.module === "infodoc")}
        organizationName={organizationName}
        canSwitch={canSwitch}
        documents={documents.length}
      />
    </>
  );
}
