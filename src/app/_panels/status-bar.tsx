"use client";

// The status bar under a canvas (prototype renderStatus, the parts of slice 1a): mapped attributes on this canvas,
// mappings and drafts, type problems, relationships.

import { useMemo } from "react";
import type { WorkspaceModel } from "@/domain/types";
import { indexModel } from "./model-index";
import { canvasStatus } from "./stats";

export function StatusBar({ model, entityIds }: { model: WorkspaceModel; entityIds: string[] }) {
  const s = useMemo(() => canvasStatus(indexModel(model), entityIds), [model, entityIds]);
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
    </footer>
  );
}
