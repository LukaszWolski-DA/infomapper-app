"use client";

// The modules' part of a canvas page in the browser (slice 15a, AD-33): the roles of dimensional entities (the
// entity panel) and the entities a module creates (the left panel's tab, the canvas's toolbox). The page builds it
// once on the server through the composition root; nothing here knows a module. Slice 15d (D4): with the page's model,
// also what feeds the dimensional attributes, for the canvas's and the panels' requirement index, derived here from the
// page's module rows once per data version (no bytes of its own on the page). Slice 20 (Łukasz's step 2 decisions):
// with the page's requirements too, the page's one requirement index (the canvas, the details panel, the status bar)
// and its model checks' index, both once per data version.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { RequirementFeedsCtx } from "@/canvas/fade-canvas";
import { ChecksCtx, checksNow, RequirementIndexCtx } from "@/canvas/checks";
import { pageCheckIndex } from "@/compose/checks";
import { requirementFeeds } from "@/compose/feeds";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import type { Requirement, RequirementLink, WorkspaceModel } from "@/domain/types";
import { NO_MODULES, type ModuleView } from "@/ui/modules";

const ModulesCtx = createContext<ModuleView>(NO_MODULES);

export const useModules = () => useContext(ModulesCtx);

/** The requirement feeds of the page (slice 15d); undefined outside a provider with a model. */
export const useRequirementFeeds = () => useContext(RequirementFeedsCtx);
/** The page's requirement index (slice 20); null outside a provider with requirements. */
export const usePageRequirementIndex = () => useContext(RequirementIndexCtx);
/** The page's check index (slice 20); null outside a provider with requirements. */
export const useChecks = () => useContext(ChecksCtx);

export function ModulesProvider({
  view,
  model,
  requirements,
  requirementLinks,
  children,
}: {
  view: ModuleView;
  model?: WorkspaceModel;
  requirements?: readonly Requirement[];
  requirementLinks?: readonly RequirementLink[];
  children: ReactNode;
}) {
  const feeds = useMemo(() => (model ? requirementFeeds(view, model) : undefined), [view, model]);
  const rx = useMemo(() => (model && requirements && requirementLinks ? buildRequirementIndex(requirements, requirementLinks, model, feeds) : null), [model, requirements, requirementLinks, feeds]);
  const checks = useMemo(() => (model && rx ? pageCheckIndex(view, model, rx.lookup) : null), [view, model, rx]);
  // for what reads the index outside a render (a mark's title on hover)
  useEffect(() => checksNow.set(checks), [checks]);
  return (
    <ModulesCtx.Provider value={view}>
      <RequirementFeedsCtx.Provider value={feeds}>
        <RequirementIndexCtx.Provider value={rx}>
          <ChecksCtx.Provider value={checks}>{children}</ChecksCtx.Provider>
        </RequirementIndexCtx.Provider>
      </RequirementFeedsCtx.Provider>
    </ModulesCtx.Provider>
  );
}
