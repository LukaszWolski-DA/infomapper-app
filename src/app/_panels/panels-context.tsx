"use client";

// Shared by the left and the right panel and the canvas toolbox: after “+” or the Entity tool creates an entity, the
// right panel focuses its name as soon as the new card has arrived from the server (D-46); “Edit transformation
// rule…” in the toolbox opens the mapping panel's rule (slice 1b). The concept last used for a new entity is
// remembered in the browser: the Entity tool puts new entities there.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readPreference, writePreference } from "@/canvas/CanvasProvider";

const LAST_CONCEPT_KEY = "infomapper:last-concept";

interface PanelsApi {
  /** The card whose entity name the right panel should focus next. */
  nameFocus: string | null;
  setNameFocus: (cardId: string | null) => void;
  /** The mapping whose rule the mapping panel should open next. */
  ruleFocus: string | null;
  setRuleFocus: (mappingId: string | null) => void;
  /** The mapping whose “Merge mappings” section the mapping panel should open next (toolbox, D-49). */
  mergeFocus: string | null;
  setMergeFocus: (mappingId: string | null) => void;
  /** The concept a new entity went into last (it may have been deleted since). */
  lastConcept: () => string | null;
  setLastConcept: (conceptId: string) => void;
}

const noop = () => {};
const PanelsCtx = createContext<PanelsApi>({
  nameFocus: null,
  setNameFocus: noop,
  ruleFocus: null,
  setRuleFocus: noop,
  mergeFocus: null,
  setMergeFocus: noop,
  lastConcept: () => null,
  setLastConcept: noop,
});

export const usePanels = () => useContext(PanelsCtx);

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [nameFocus, setNameFocus] = useState<string | null>(null);
  const [ruleFocus, setRuleFocus] = useState<string | null>(null);
  const [mergeFocus, setMergeFocus] = useState<string | null>(null);
  const lastConcept = useCallback(() => readPreference(LAST_CONCEPT_KEY), []);
  const setLastConcept = useCallback((conceptId: string) => writePreference(LAST_CONCEPT_KEY, conceptId), []);
  const api = useMemo(
    () => ({ nameFocus, setNameFocus, ruleFocus, setRuleFocus, mergeFocus, setMergeFocus, lastConcept, setLastConcept }),
    [nameFocus, ruleFocus, mergeFocus, lastConcept, setLastConcept],
  );
  return <PanelsCtx.Provider value={api}>{children}</PanelsCtx.Provider>;
}
