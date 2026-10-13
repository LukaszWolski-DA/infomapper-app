"use client";

// “Labels in this project” on the project home (D-29, slice 3a, prototype renderHome and projLabels): the labels used
// on the project's canvases and the ones pinned to it, pinned first. The star pins and unpins a label (saved, not an
// undo step) and is offered only to roles with label rights; the name opens the label's panel on a canvas of the
// project. “Open as live canvas” (or “Open live canvas” when it has one) opens its live canvas in this project
// (slice 3b); only roles that create canvases make a new one.

import Link from "next/link";
import { setLabelPinnedAction } from "@/app/_actions/label";
import { useOpenLiveCanvas } from "@/app/_components/live-canvas";
import { useAction } from "@/app/_components/use-action";
import { TagIcon } from "@/app/_panels/labels-field";

export interface ProjectLabelRow {
  id: string;
  name: string;
  items: number;
  pinned: boolean;
  /** It has a live canvas (slice 3b). */
  live: boolean;
  /** The canvas page that opens the label's panel. */
  href: string;
}

export function ProjectLabels({ workspaceId, projectId, labels, editable }: { workspaceId: string; projectId: string; labels: ProjectLabelRow[]; editable: boolean }) {
  const { run, pending } = useAction();
  const openLive = useOpenLiveCanvas(workspaceId, projectId);
  if (!labels.length) return <p className="text-im-ink-3">No labels used on this project’s canvases yet.</p>;
  return (
    <div className="flex flex-col gap-0.5" data-testid="list-project-labels">
      {labels.map((l) => (
        <div key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-im-hover" data-testid="item-project-label" data-label={l.name} data-pinned={l.pinned || undefined}>
          {editable ? (
            <button
              type="button"
              disabled={pending}
              aria-pressed={l.pinned}
              title={`${l.pinned ? "Unpin from" : "Pin to"} this project`}
              className={`w-5 text-center text-[15px] leading-none disabled:cursor-default ${l.pinned ? "text-im-review-strong" : "text-im-ink-3 enabled:hover:text-im-ink"}`}
              data-testid="button-label-pin"
              onClick={() => void run(() => setLabelPinnedAction(workspaceId, { projectId, labelId: l.id, pinned: !l.pinned }))}
            >
              {l.pinned ? "★" : "☆"}
            </button>
          ) : (
            // without label rights the star is not offered: a pinned label keeps a plain marker, the others an empty slot
            <span className="w-5 cursor-default select-none text-center text-[15px] leading-none text-im-review-strong" title={l.pinned ? "Pinned to this project" : undefined} data-testid={l.pinned ? "mark-label-pinned" : undefined}>
              {l.pinned ? "★" : ""}
            </span>
          )}
          <span className="text-im-ink-3">
            <TagIcon className="size-[13px]" />
          </span>
          <Link href={l.href} className="min-w-0 flex-1 truncate hover:underline" data-testid="link-project-label">
            {l.name}
          </Link>
          <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">
            {l.items} item{l.items === 1 ? "" : "s"}
          </span>
          {(l.live || editable) && (
            <button
              type="button"
              disabled={openLive.pending}
              className="h-[26px] whitespace-nowrap rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover"
              onClick={() => void openLive.open(l.id)}
              data-testid="button-project-label-live"
            >
              {l.live ? "Open live canvas" : "Open as live canvas"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
