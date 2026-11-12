"use client";

// InfoDocumenter's box in the workspace settings (slice 25, step 4; AD-35, as InfoCube's box): shown to everyone, below
// InfoCube's; its check box enabled for owners and admins when the organization holds the licence, and while on whatever
// the licence, so it can always be turned off (turning it off deletes nothing). On the workspace's save chain.

import { useState } from "react";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { useChoice } from "@/app/_panels/fields";

export const INFODOC_BOX_TEXT =
  "Documents generated from the model: data dictionary, mappings and the dimensional model. Turning it off deletes nothing: the documents are kept and come back when it is turned on again.";
export const INFODOC_ON_MESSAGE = "InfoDocumenter is on: see the Documentation tab.";
export const infoDocOffMessage = (n: number) =>
  n === 0 ? "InfoDocumenter is off." : `InfoDocumenter is off. Its ${n} document${n === 1 ? " is" : "s are"} kept for when it is on again.`;

export interface InfoDocumenterBoxProps {
  workspaceId: string;
  version: number;
  on: boolean;
  licensed: boolean;
  organizationName: string;
  /** An owner or an admin, in a workspace that is not archived. */
  canSwitch: boolean;
  /** The workspace's live documents, for the toast when it is turned off. */
  documents: number;
}

export function InfoDocumenterBox({ workspaceId, version, on, licensed, organizationName, canSwitch, documents }: InfoDocumenterBoxProps) {
  const { saveRow } = useAction();
  const [refusal, setRefusal] = useState<string | null>(null);
  const choice = useChoice(on, async (infodoc: boolean) => {
    setRefusal(null);
    const answer = await saveRow(
      { id: workspaceId, version },
      (v) => updateWorkspaceSettingsAction({ workspaceId, expectedVersion: v, infodoc }),
      infodoc ? INFODOC_ON_MESSAGE : infoDocOffMessage(documents),
      { quiet: true },
    );
    if (!answer.ok && answer.message) setRefusal(answer.message);
    return answer;
  });
  return (
    <div className="mt-4 rounded-lg border border-im-line px-3 py-2.5" data-testid="box-infodoc">
      <h4 className="m-0 mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold">
        <DocIcon />
        InfoDocumenter
      </h4>
      <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">{INFODOC_BOX_TEXT}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="checkbox-infodoc"
          checked={choice.value}
          disabled={!canSwitch || (!licensed && !choice.value)}
          onChange={(e) => choice.choose(e.currentTarget.checked)}
        />{" "}
        Use InfoDocumenter in this workspace
      </label>
      {refusal && (
        <p className="m-0 mt-1.5 text-[12px] text-im-warn" role="alert" data-testid="text-infodoc-refusal">
          {refusal}
        </p>
      )}
      <div className="mt-2 text-[12px] text-im-ink-3" data-testid="text-infodoc-licence">
        {licensed ? `Licensed for ${organizationName}.` : `${organizationName} has no InfoDocumenter licence.`}
      </div>
    </div>
  );
}

/** The prototype's `DOC_IC`: a page with a folded corner and two lines. */
export const DocIcon = () => (
  <svg viewBox="0 0 12 12" className="size-3.5 fill-none stroke-current stroke-[1.1]" aria-hidden>
    <path d="M3 1.2h4.2L9.6 3.6v7.2H3z" />
    <path d="M7 1.2v2.6h2.6M4.6 6h3.2M4.6 8h3.2" />
  </svg>
);
