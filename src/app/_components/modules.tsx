"use client";

// The modules' part of a canvas page in the browser (slice 15a, AD-33): the roles of dimensional entities (the
// entity panel) and the entities a module creates (the left panel's tab, the canvas's toolbox). The page builds it
// once on the server through the composition root; nothing here knows a module. Slice 15d (D4): with the page's model,
// also what feeds the dimensional attributes, for the canvas's and the panels' requirement index, derived here from the
// page's module rows once per data version (no bytes of its own on the page).

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { RequirementFeedsCtx } from "@/canvas/fade-canvas";
import { requirementFeeds } from "@/compose/feeds";
import type { WorkspaceModel } from "@/domain/types";
import { NO_MODULES, type ModuleView } from "@/ui/modules";

const ModulesCtx = createContext<ModuleView>(NO_MODULES);

export const useModules = () => useContext(ModulesCtx);

/** The requirement feeds of the page (slice 15d); undefined outside a provider with a model. */
export const useRequirementFeeds = () => useContext(RequirementFeedsCtx);

export function ModulesProvider({ view, model, children }: { view: ModuleView; model?: Pick<WorkspaceModel, "entities" | "attributes">; children: ReactNode }) {
  const feeds = useMemo(() => (model ? requirementFeeds(view, model) : undefined), [view, model]);
  return (
    <ModulesCtx.Provider value={view}>
      <RequirementFeedsCtx.Provider value={feeds}>{children}</RequirementFeedsCtx.Provider>
    </ModulesCtx.Provider>
  );
}
