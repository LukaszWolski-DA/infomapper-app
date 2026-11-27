"use client";

// InfoCatalog's box in the workspace settings (slice 39, S39-02, A2.3): "Shown in InfoCatalog to everyone in the
// organization", off by default. Shown only while the organization holds the licence (unlike the module switches'
// boxes, AD-35, which show the missing licence: nothing reveals InfoCatalog to an organization without it); its check box
// enabled for the workspace's owners and admins in a workspace that is not archived. No module switch: members of the
// workspace find it in InfoCatalog either way. On the workspace's save chain, a change event, no undo step.

import { useState } from "react";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { useChoice } from "@/app/_panels/fields";
import { Check } from "@/ui/components/check";

export const CATALOG_SWITCH_LABEL = "Shown in InfoCatalog to everyone in the organization";
export const catalogSwitchLine = (workspace: string, organization: string) =>
  `Members of ${workspace} always find it in InfoCatalog. With this on, everyone in ${organization} can find and read it there, but not change it.`;
export const catalogShownMessage = (workspace: string, organization: string) => `${workspace} is shown in InfoCatalog to everyone in ${organization}.`;
export const catalogMembersMessage = (workspace: string) => `${workspace} is shown in InfoCatalog to its members only.`;

export interface InfoCatalogBoxProps {
  workspaceId: string;
  workspaceName: string;
  version: number;
  on: boolean;
  organizationName: string;
  /** An owner or an admin, in a workspace that is not archived. */
  canSwitch: boolean;
}

export function InfoCatalogBox({ workspaceId, workspaceName, version, on, organizationName, canSwitch }: InfoCatalogBoxProps) {
  const { saveRow } = useAction();
  const [refusal, setRefusal] = useState<string | null>(null);
  const choice = useChoice(on, async (catalogShown: boolean) => {
    setRefusal(null);
    const answer = await saveRow(
      { id: workspaceId, version },
      (v) => updateWorkspaceSettingsAction({ workspaceId, expectedVersion: v, catalogShown }),
      catalogShown ? catalogShownMessage(workspaceName, organizationName) : catalogMembersMessage(workspaceName),
      { quiet: true },
    );
    if (!answer.ok && answer.message) setRefusal(answer.message);
    return answer;
  }, version);
  return (
    <div className="mt-4 rounded-lg border border-im-line px-3 py-2.5" data-testid="box-infocatalog">
      <h4 className="m-0 mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold">
        <CatalogIcon />
        InfoCatalog
      </h4>
      <Check
        data-testid="checkbox-catalog-shown"
        checked={choice.value}
        disabled={!canSwitch}
        onChange={(e) => choice.choose(e.currentTarget.checked)}
        aria-describedby="text-catalog-shown-line"
        label={CATALOG_SWITCH_LABEL}
      />
      <p id="text-catalog-shown-line" className="m-0 mt-1 text-[12.5px] text-im-ink-2" data-testid="text-catalog-shown-line">
        {catalogSwitchLine(workspaceName, organizationName)}
      </p>
      {refusal && (
        <p className="m-0 mt-1.5 text-[12px] text-im-warn" role="alert" data-testid="text-catalog-shown-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}

/** A magnifier over a page: InfoCatalog's mark (the prototype's apps tile draws a search glass). */
const CatalogIcon = () => (
  <svg viewBox="0 0 12 12" className="size-3.5 fill-none stroke-current stroke-[1.1]" aria-hidden>
    <circle cx="5" cy="5" r="3.2" />
    <path d="M7.4 7.4l3.2 3.2" />
  </svg>
);
