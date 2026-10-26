"use client";

// The status bar under a canvas (prototype renderStatus, the parts of slice 1a): mapped attributes on this canvas,
// mappings and drafts, type problems, relationships; the workspace's requirements and how many are covered (slice 4a,
// from the server's requirement index, fresh after every write); the open notes on this canvas (slice 6a, from the
// canvas's counts once it is mounted, the page's before); and the working context with its item count (slice 3b).
// Focus's chip moved to the view-state bar in slice 6a. Slice 7b (item 23): the workspace's open changes to resolve, in
// the warning style, only while one is open.

import { useMemo } from "react";
import type { WorkspaceModel } from "@/domain/types";
import { useValue } from "@/canvas/value-store";
import { viewCounts } from "@/canvas/view-counts";
import { WorkingContextStatus } from "../_components/working-context";
import { indexModel } from "./model-index";
import { canvasStatus } from "./stats";

export function StatusBar({
  model,
  entityIds,
  requirements,
  openNotes,
  sourceChanges,
}: {
  model: WorkspaceModel;
  entityIds: string[];
  requirements: { count: number; covered: number };
  /** Open notes on this canvas as the page read them, until the canvas publishes its own count. */
  openNotes: number;
  /** Open changes to resolve in the workspace (slice 7b). */
  sourceChanges: number;
}) {
  const s = useMemo(() => canvasStatus(indexModel(model), entityIds), [model, entityIds]);
  const counts = useValue(viewCounts);
  return (
    <footer
      data-testid="bar-status"
      className="flex h-7 flex-none items-center gap-[18px] overflow-hidden whitespace-nowrap border-t border-im-line bg-im-surface px-3 text-[11.5px] text-im-ink-3 [&_b]:font-medium [&_b]:text-im-ink-2"
    >
      <span data-testid="status-mapped">
        Mapped attributes on canvas{" "}
        <b>
          {s.mapped} of {s.attributes}
        </b>
      </span>
      <span data-testid="status-mappings">
        Mappings <b>{s.mappings}</b>, drafts <b>{s.drafts}</b>
      </span>
      <span data-testid="status-type-problems" className={s.typeProblems ? "[&_b]:!text-im-warn" : ""}>
        Type problems <b>{s.typeProblems}</b>
      </span>
      <span data-testid="status-relationships">
        Relationships <b>{s.relationships}</b>
      </span>
      <span data-testid="status-requirements">
        Requirements <b>{requirements.count}</b>, covered <b>{requirements.covered}</b>
      </span>
      <span data-testid="status-notes">
        Open notes on canvas <b>{counts?.openNotes ?? openNotes}</b>
      </span>
      {sourceChanges > 0 && (
        <span data-testid="status-source-changes" className="[&_b]:!text-im-warn">
          Source changes to resolve <b>{sourceChanges}</b>
        </span>
      )}
      <WorkingContextStatus />
    </footer>
  );
}
