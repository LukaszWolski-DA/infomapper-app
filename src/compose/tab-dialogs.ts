// The modules' dialogs that a left panel tab's button opens (slice 15d, D11; `ModuleTab.actions`), by the action's key.
// Apart from `src/compose/index.ts`, so that the domain's and the store's callers never load client components.

import type { ComponentType } from "react";
import type { TabDialogProps } from "@/ui/modules";
import { BusMatrixDialog } from "@/modules/infocube/app/bus-matrix-dialog";

export const TAB_DIALOGS: Readonly<Record<string, ComponentType<TabDialogProps>>> = {
  "bus-matrix": BusMatrixDialog,
};
