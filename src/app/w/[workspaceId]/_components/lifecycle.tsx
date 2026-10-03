"use client";

// Archive and unarchive (AD-09). Only the owner may; an admin sees the button disabled with a hint.

import { archiveWorkspaceAction, unarchiveWorkspaceAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";

interface Props {
  workspaceId: string;
  workspaceName: string;
  version: number;
  archived: boolean;
}

export const btnClass =
  "inline-flex h-[26px] items-center rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-im-surface";

function useArchive({ workspaceId, workspaceName, version, archived }: Props) {
  const { run, pending } = useAction();
  const toggle = () =>
    run(
      () => (archived ? unarchiveWorkspaceAction : archiveWorkspaceAction)({ workspaceId, expectedVersion: version }),
      archived ? `${workspaceName} is editable again.` : `Archived ${workspaceName}. It is read-only now.`,
    );
  return { toggle, pending };
}

export function ArchiveBox(props: Props & { isOwner: boolean }) {
  const { toggle, pending } = useArchive(props);
  const { archived, isOwner } = props;
  const verb = archived ? "Unarchive" : "Archive";
  return (
    <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]" data-testid="box-archive">
      <h4 className="m-0 mb-1 text-[13.5px] font-semibold">{verb}</h4>
      <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">
        {archived
          ? "Make it editable again."
          : "Freeze it as read-only, e.g. when the project at the client is over. It stays visible and searchable."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={archived ? "button-unarchive" : "button-archive"}
          className={btnClass}
          disabled={!isOwner || pending}
          onClick={() => void toggle()}
        >
          {verb}
        </button>
        {!isOwner && (
          <span data-testid="hint-archive-owner-only" className="text-[11.5px] text-im-ink-3">
            Only the owner can {verb.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}

/** The Unarchive button in the archived banner, for the owner. */
export function UnarchiveButton(props: Omit<Props, "archived">) {
  const { toggle, pending } = useArchive({ ...props, archived: true });
  return (
    <button type="button" data-testid="button-unarchive-banner" className={btnClass} disabled={pending} onClick={() => void toggle()}>
      Unarchive
    </button>
  );
}
