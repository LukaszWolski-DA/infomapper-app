// The modules' boxes in the workspace settings (slice 15a, E4, O2): InfoCube's, always shown.

import type { DataStore } from "@/data";
import { can, type WorkspaceAccess } from "@/domain/permissions";
import { InfoCubeBox } from "@/modules/infocube/app/infocube-box";

export async function settingsBoxes(store: DataStore, access: WorkspaceAccess) {
  const { workspace } = access;
  const [organization, licences] = await Promise.all([store.organizations.get(workspace.organization_id), store.organizations.listLicences(workspace.organization_id)]);
  return (
    <InfoCubeBox
      workspaceId={workspace.id}
      version={workspace.version}
      on={workspace.infocube}
      licensed={licences.some((l) => l.module === "infocube")}
      organizationName={organization?.name ?? ""}
      canSwitch={can(access, "workspace.edit_settings")}
    />
  );
}
