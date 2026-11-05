"use client";

// The InfoCube box of the workspace settings (slice 15a, C-7, O2; prototype `wsSettings`): shown to everyone, its
// check box enabled for owners and admins when the organization holds the licence, and while on whatever the licence
// (slice 15b, R1). Turning it on needs the licence;
// turning it off is refused while the workspace has facts or dimensions, and the refusal stays under the check box.
// It saves the workspace's row on the same chain as the other settings (slice 9).

import { useState } from "react";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { useChoice } from "@/app/_panels/fields";
import { CubeIcon } from "../ui/cube-icon";

export const INFOCUBE_BOX_TEXT =
  "Dimensional modelling on top of the logical model: facts, dimensions, and mappings from logical attributes. It can be turned off only while the workspace has no facts or dimensions.";
export const INFOCUBE_ON_MESSAGE = "InfoCube is on: facts and dimensions are in the Cube tab.";
export const INFOCUBE_OFF_SAVED = "InfoCube is off.";

export interface InfoCubeBoxProps {
  workspaceId: string;
  version: number;
  on: boolean;
  licensed: boolean;
  organizationName: string;
  /** An owner or an admin, in a workspace that is not archived. */
  canSwitch: boolean;
}

export function InfoCubeBox({ workspaceId, version, on, licensed, organizationName, canSwitch }: InfoCubeBoxProps) {
  const { saveRow } = useAction();
  const [refusal, setRefusal] = useState<string | null>(null);
  const choice = useChoice(on, async (infocube: boolean) => {
    setRefusal(null);
    const answer = await saveRow(
      { id: workspaceId, version },
      (v) => updateWorkspaceSettingsAction({ workspaceId, expectedVersion: v, infocube }),
      infocube ? INFOCUBE_ON_MESSAGE : INFOCUBE_OFF_SAVED,
      { quiet: true },
    );
    if (!answer.ok && answer.message) setRefusal(answer.message);
    return answer;
  });
  return (
    <div className="mt-4 rounded-lg border border-im-line px-3 py-2.5" data-testid="box-infocube">
      <h4 className="m-0 mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold">
        <CubeIcon />
        InfoCube
      </h4>
      <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">{INFOCUBE_BOX_TEXT}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="checkbox-infocube"
          // as the prototype (slice 15b, R1): while on it stays ticked and enabled, licence or not, so it can be turned off
          checked={choice.value}
          disabled={!canSwitch || (!licensed && !choice.value)}
          onChange={(e) => choice.choose(e.currentTarget.checked)}
        />{" "}
        Use InfoCube in this workspace
      </label>
      {refusal && (
        <p className="m-0 mt-1.5 text-[12px] text-im-warn" role="alert" data-testid="text-infocube-refusal">
          {refusal}
        </p>
      )}
      <div className="mt-2 text-[12px] text-im-ink-3" data-testid="text-infocube-licence">
        {licensed ? `Licensed for ${organizationName}.` : `${organizationName} has no InfoCube licence.`}
      </div>
    </div>
  );
}
