"use client";

// The active working context as the page's components see it (slice 3b): the provider is the canvas page's
// (`src/app/_components/working-context.tsx`); the canvas and the panels read it here.

import { createContext, useContext } from "react";
import type { CountedLabel } from "@/domain/model/labels";

export interface WorkingContextApi {
  /** The label the person works on, or null. */
  active: CountedLabel | null;
  /** The workspace's labels with how many items each marks. */
  labels: readonly CountedLabel[];
  /** Turns the context on for a label, or off (null). */
  set: (labelId: string | null) => void;
  /** Creates a label and turns the context on for it. */
  create: (name: string) => void;
}

export const WorkingContextCtx = createContext<WorkingContextApi | null>(null);

/** Null where there is no switch: roles without label rights, pages without a canvas. */
export const useWorkingContext = (): WorkingContextApi | null => useContext(WorkingContextCtx);
