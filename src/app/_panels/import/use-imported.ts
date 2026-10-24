"use client";

// After an import (slice 7a, item 28): the Sources tab, the system selected and its panel open. An action that leads to
// details on purpose, so it opens the details panel (CLAUDE.md, side panels). Used by “Import sources…” in the left
// panel and by “Re-import {system}…” on the system's panel. A new system arrives with the page's refresh; until then
// the details panel shows the canvas overview.

import { useCallback, useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { ImportOutcome } from "@/domain/commands/import";
import { useSidePanels } from "../../_components/side-panels";
import { usePanels } from "../panels-context";

export function useImported(): (outcome: ImportOutcome) => void {
  const ui = useContext(CanvasUiCtx);
  const { openDetails } = useSidePanels();
  const { setLeftTab } = usePanels();
  return useCallback(
    (outcome: ImportOutcome) => {
      setLeftTab("sources");
      openDetails();
      ui.select({ t: "element", kind: "source_system", id: outcome.systemId });
    },
    [ui, openDetails, setLeftTab],
  );
}
