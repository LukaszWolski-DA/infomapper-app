"use client";

// Shared by the left and the right panel and the canvas toolbox: after “+” or the Entity tool creates an entity, the
// right panel focuses its name as soon as the new card has arrived from the server (D-46); “Edit transformation
// rule…” in the toolbox opens the mapping panel's rule (slice 1b). The left panel's tab is shared too: after an
// import, from the left panel or from a system's panel, the Sources tab shows (slice 7a, item 28). Since slice 17
// (D-72) no concept is remembered: outside a concept frame a new entity's concept is chosen in a picker.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** InfoMapper's three tabs, or a module's tab by its id (slice 15a, E6). */
export type LeftTab = "model" | "sources" | "requirements" | (string & {});

interface PanelsApi {
  /** The left panel's open tab. */
  leftTab: LeftTab;
  setLeftTab: (tab: LeftTab) => void;
  /** The card whose entity name the right panel should focus next. */
  nameFocus: string | null;
  setNameFocus: (cardId: string | null) => void;
  /** The mapping whose rule the mapping panel should open next. */
  ruleFocus: string | null;
  setRuleFocus: (mappingId: string | null) => void;
  /** The mapping whose “Merge mappings” section the mapping panel should open next (toolbox, D-49). */
  mergeFocus: string | null;
  setMergeFocus: (mappingId: string | null) => void;
}

const noop = () => {};
const PanelsCtx = createContext<PanelsApi>({
  leftTab: "model",
  setLeftTab: noop,
  nameFocus: null,
  setNameFocus: noop,
  ruleFocus: null,
  setRuleFocus: noop,
  mergeFocus: null,
  setMergeFocus: noop,
});

export const usePanels = () => useContext(PanelsCtx);

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [leftTab, setLeftTab] = useState<LeftTab>("model");
  const [nameFocus, setNameFocus] = useState<string | null>(null);
  const [ruleFocus, setRuleFocus] = useState<string | null>(null);
  const [mergeFocus, setMergeFocus] = useState<string | null>(null);
  const api = useMemo(
    () => ({ leftTab, setLeftTab, nameFocus, setNameFocus, ruleFocus, setRuleFocus, mergeFocus, setMergeFocus }),
    [leftTab, nameFocus, ruleFocus, mergeFocus],
  );
  return <PanelsCtx.Provider value={api}>{children}</PanelsCtx.Provider>;
}
