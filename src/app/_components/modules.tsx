"use client";

// The modules' part of a canvas page in the browser (slice 15a, AD-33): the roles of dimensional entities (the
// entity panel) and the entities a module creates (the left panel's tab, the canvas's toolbox). The page builds it
// once on the server through the composition root; nothing here knows a module.

import { createContext, useContext, type ReactNode } from "react";
import { NO_MODULES, type ModuleView } from "@/ui/modules";

const ModulesCtx = createContext<ModuleView>(NO_MODULES);

export const useModules = () => useContext(ModulesCtx);

export function ModulesProvider({ view, children }: { view: ModuleView; children: ReactNode }) {
  return <ModulesCtx.Provider value={view}>{children}</ModulesCtx.Provider>;
}
