// The modules' server actions that InfoMapper's pages hand to the browser (slice 15a, AD-33): apart from
// `src/compose/index.ts`, so that the domain's and the store's callers (and their tests) never load server actions.

import { createDimensionAction, createFactAction } from "@/modules/infocube/app/actions";
import type { CreateActions } from "./view";

export const CREATE_ACTIONS: CreateActions = { fact: createFactAction, dimension: createDimensionAction };
