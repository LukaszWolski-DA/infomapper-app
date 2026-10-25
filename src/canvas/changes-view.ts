// The Changes view's state (slice 7b, items 26–27): what it shows, its bar's counts, the imports its select offers, and
// the rule that it and Focus exclude each other (Q6, D-39). The client components share the stores (`Changes.tsx`); the
// imports for the select are built on the server (`changes-import.ts`).

import type { ChangesSelection } from "@/domain/source-changes/touched";
import { focusOn } from "./fade";
import { createValueStore } from "./value-store";

/** What the view shows: all open changes or one import's, with the chip's words (“all open”, “import into CRM, …”). */
export interface ChangesView {
  sel: ChangesSelection;
  chip: string;
}

export const ALL_OPEN: ChangesView = { sel: "open", chip: "all open" };
export const CHANGES_TITLE = "Show only what source changes touch";
export const NOTHING_ON_RECORD = "Nothing on record";

export const changesOn = createValueStore<ChangesView | null>(null);
/** What the view lights, for its bar; null while it is off. */
export const changesCounts = createValueStore<{ tables: number; mappings: number; attributes: number } | null>(null, (a, b) =>
  a === b || (!!a && !!b && a.tables === b.tables && a.mappings === b.mappings && a.attributes === b.attributes),
);

// the Changes view and Focus exclude each other (Q6): turning one on turns the other off
focusOn.subscribe(() => {
  if (focusOn.get()) changesOn.set(null);
});
changesOn.subscribe(() => {
  if (changesOn.get()) focusOn.set(false);
});

export const toggleChanges = () => changesOn.set(changesOn.get() ? null : ALL_OPEN);
