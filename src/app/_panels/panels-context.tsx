"use client";

// Shared by the left and the right panel: after “+” creates an entity, the right panel focuses its name as soon as the
// new card has arrived from the server (D-46).

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface PanelsApi {
  /** The card whose entity name the right panel should focus next. */
  nameFocus: string | null;
  setNameFocus: (cardId: string | null) => void;
}

const PanelsCtx = createContext<PanelsApi>({ nameFocus: null, setNameFocus: () => {} });

export const usePanels = () => useContext(PanelsCtx);

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [nameFocus, setNameFocus] = useState<string | null>(null);
  const api = useMemo(() => ({ nameFocus, setNameFocus }), [nameFocus]);
  return <PanelsCtx.Provider value={api}>{children}</PanelsCtx.Provider>;
}
