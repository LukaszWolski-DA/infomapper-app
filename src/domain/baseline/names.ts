// A baseline's name and note (slice 35, B1.3): the name required, trimmed, at most 120 characters and unique among the
// workspace's live baselines in any letter case; the note optional, trimmed, at most 1,000 characters.

import type { Uuid } from "../ids";
import type { Baseline } from "../types";

export const BASELINE_NAME_MAX = 120;
export const BASELINE_NOTE_MAX = 1000;

export const NAME_REQUIRED_MESSAGE = "Give the baseline a name.";
export const NAME_TOO_LONG_MESSAGE = `A baseline's name has at most ${BASELINE_NAME_MAX} characters.`;
export const NOTE_TOO_LONG_MESSAGE = `A baseline's note has at most ${BASELINE_NOTE_MAX.toLocaleString("en-GB")} characters.`;
export const nameTakenMessage = (name: string): string => `A baseline named ${name} already exists in this workspace.`;
export const BASELINE_GONE_MESSAGE = "This baseline no longer exists.";

/**
 * What two names are compared by (step 1's F6): the trimmed name in lower case with repeated spaces as one. Not D-78's
 * rule, which also ignores `_`, `-` and `/`: "Stage 2" and "Stage-2" are two baselines.
 */
export const baselineNameKey = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase();

/** The live baseline other than `exceptId` whose name is this one in any letter case, if any. */
export function baselineNameTakenBy(list: readonly Baseline[], name: string, exceptId: Uuid | null = null): Baseline | null {
  const key = baselineNameKey(name);
  return list.find((b) => b.deleted_at === null && b.id !== exceptId && b.name_key === key) ?? null;
}

/** The note as stored: trimmed, null when empty. */
export const storedNote = (note: string | null | undefined): string | null => {
  const t = (note ?? "").trim();
  return t ? t : null;
};

/** Newest first (the list, "Compared with"): by the time taken, then by id. */
export const newestBaselineFirst = (a: Pick<Baseline, "created_at" | "id">, b: Pick<Baseline, "created_at" | "id">): number =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
