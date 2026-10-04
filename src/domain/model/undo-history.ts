// The undo history of one person in one workspace (slice 1b): the last 50 change groups they can undo, and the
// steps they undid and can redo. Pure values; the server keeps one per person and workspace in memory for now
// (persistent history comes with Supabase). Each step holds its change group's events, which `revertChangeGroup`
// turns into the opposite change group.

import type { Uuid } from "../ids";
import type { ChangeEvent } from "../types";

export const UNDO_LIMIT = 50;

export interface UndoStep {
  changeGroupId: Uuid;
  /** What the person did, for the toasts, e.g. “Rename entity”. */
  label: string;
  events: readonly ChangeEvent[];
}

export interface UndoHistory {
  /** Oldest first; the last one is undone next. */
  undo: readonly UndoStep[];
  /** Oldest first; the last one is redone next. */
  redo: readonly UndoStep[];
}

export const emptyHistory: UndoHistory = { undo: [], redo: [] };

/** The key of a history: one per person and workspace. */
export const historyKey = (workspaceId: Uuid, userId: Uuid): string => `${workspaceId}|${userId}`;

const capped = (steps: readonly UndoStep[]): readonly UndoStep[] => steps.slice(-UNDO_LIMIT);

/** A new change by the person: it can be undone, and what was undone before can no longer be redone. */
export const recordChange = (history: UndoHistory, step: UndoStep): UndoHistory => ({ undo: capped([...history.undo, step]), redo: [] });

export const nextUndo = (history: UndoHistory): UndoStep | null => history.undo.at(-1) ?? null;
export const nextRedo = (history: UndoHistory): UndoStep | null => history.redo.at(-1) ?? null;

/** The last step was undone by the change group `revert`: redo reverts that group again. */
export const afterUndo = (history: UndoHistory, revert: UndoStep): UndoHistory => ({
  undo: history.undo.slice(0, -1),
  redo: capped([...history.redo, revert]),
});

/** The last undone step was redone by the change group `revert`: undo reverts that group again. */
export const afterRedo = (history: UndoHistory, revert: UndoStep): UndoHistory => ({
  undo: capped([...history.undo, revert]),
  redo: history.redo.slice(0, -1),
});

/**
 * A step that cannot be undone (or redone) because it was changed afterwards is dropped, so the next Ctrl+Z goes
 * further back (Łukasz, 4 October 2026).
 */
export const dropNextUndo = (history: UndoHistory): UndoHistory => ({ ...history, undo: history.undo.slice(0, -1) });
export const dropNextRedo = (history: UndoHistory): UndoHistory => ({ ...history, redo: history.redo.slice(0, -1) });

/** The toast after a dropped step. */
export const refusedStepMessage = (mode: "undo" | "redo", label: string): string =>
  mode === "undo"
    ? `Couldn't undo “${label}” because it was changed afterwards. Ctrl+Z again goes further back.`
    : `Couldn't redo “${label}” because it was changed afterwards. Ctrl+Shift+Z again goes further on.`;
