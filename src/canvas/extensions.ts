// A module's objects on the canvas (slice 15c, C4, C7, C8; AD-33's extension points): what InfoMapper's canvas host
// asks of a module whose lines it draws (`CanvasLines.modules`) and whose rows it lets you drag. The module registers
// one per kind in the composition root (`src/compose/canvas.ts`); the host calls its hook once per render with the
// page's model and cards, and knows nothing else of it.

import type { ComponentType, ReactNode } from "react";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceModel } from "@/domain/types";
import type { RowDrag, RowDrop } from "./context";

/** An item of a line's menu: the toolbox's own shapes (a head, a separator, an action). */
export type ExtMenuItem =
  | { head: string }
  | { sep: true }
  | { label: string; act: () => void; kbd?: string; danger?: boolean; disabled?: boolean; checked?: boolean; testId?: string };

/** What the host gives a module's hook. */
export interface CanvasExtContext {
  workspaceId: string;
  canvasId: string;
  /** May edit the model (not a reader or reviewer, not archived). */
  editable: boolean;
  /** May set a mapping's status (reviewers too). */
  canSetStatus: boolean;
  model: WorkspaceModel;
  /** The canvas's cards. */
  cards: readonly { id: Uuid; kind: "ent" | "src"; targetId: Uuid }[];
}

/** What a module does with its objects on the canvas. */
export interface CanvasExtHandlers {
  /** Its text when the object no longer exists (a history place), else null. */
  gone: (id: Uuid) => string | null;
  /** Its line's menu (a right-click). */
  menu: (id: Uuid) => ExtMenuItem[];
  /** Delete or Backspace with the object selected. */
  remove: (id: Uuid) => void;
  /** A drag from an entity's attribute row: what lights and what each drop does; null: not this module's drag. */
  rowDrag: (attributeId: Uuid) => RowDrag | null;
  /** An entity row's drop that `rowDrag` allowed. */
  drop: (drop: RowDrop) => void;
  /** Items of an entity card's header menu, before "Delete from model…" (slice 15c, P19: "Create dimension from this…"). */
  cardMenu?: (entityId: Uuid) => ExtMenuItem[];
  /** What the module draws beside the canvas host's dialogs (its own dialog while open), else null. */
  overlay?: ReactNode;
}

export interface CanvasExtension {
  /** The selection's kind (`{ t: "ext", kind }`): `cube_mapping`. */
  kind: string;
  /** A React hook: called once per render of the host, with the same context shape. */
  useHandlers: (context: CanvasExtContext) => CanvasExtHandlers;
  /** The object's panel in the details panel. */
  Panel: ComponentType<{ id: Uuid }>;
}
