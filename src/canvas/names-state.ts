// The canvas's names or aliases as the top bar's two check boxes show them (slice 11, D-64): each dimension's mode, or
// `mixed` while a card has an exception there (`namesControl`). `ModelCanvas` publishes it from an effect, into a store
// outside React state, so the check boxes draw and the canvas never does for them (as `viewCounts`). From the data,
// never from the page's layout. Null while no canvas is mounted.

import type { NameDimension } from "@/domain/model/aliases";
import type { NameMode } from "@/domain/types";
import { createValueStore } from "./value-store";

export type NamesState = Record<NameDimension, NameMode | "mixed">;

const same = (a: NamesState | null, b: NamesState | null) => a === b || (!!a && !!b && a.entity === b.entity && a.attribute === b.attribute);

export const namesState = createValueStore<NamesState | null>(null, same);

/** What a click on a check box sets: indeterminate or unchecked → aliases, checked → names (item 8). */
export const nextMode = (state: NameMode | "mixed"): NameMode => (state === "alias" ? "name" : "alias");
