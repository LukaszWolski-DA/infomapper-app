// Aggregate facts (slice 19, D-74; prototype `aggregatesOf`, `baseChain`): a fact may summarise another, its base. The
// base is stored (`cube_entity.base_fact_entity_id`); never the fact itself, never a cycle (the command's checks and
// undo's `aggregateRevertRefusal`). A base that is not a live fact reads as none, as the prototype's `cubeIndex` does.
// Pure.

import type { Uuid } from "@/domain/ids";
import type { CubeEntity } from "./types";

type Row = Pick<CubeEntity, "entity_id" | "role" | "base_fact_entity_id" | "deleted_at">;

export interface AggregateIndex {
  /** The fact's base while it is a live fact other than itself; null otherwise. */
  baseOf(factId: Uuid): Uuid | null;
  /** The live facts whose base is this fact, in the rows' order. */
  aggregatesOf(factId: Uuid): Uuid[];
  /** Whether `from`'s chain of bases reaches `to`, at any depth (a visited set ends a cycle). */
  reaches(from: Uuid, to: Uuid): boolean;
}

export function aggregateIndex(rows: readonly Row[]): AggregateIndex {
  const facts = new Map<Uuid, Row>();
  for (const r of rows) if (r.deleted_at === null && r.role === "fact") facts.set(r.entity_id, r);
  const baseOf = (id: Uuid): Uuid | null => {
    const b = facts.get(id)?.base_fact_entity_id ?? null;
    return b && b !== id && facts.has(b) ? b : null;
  };
  const users = new Map<Uuid, Uuid[]>();
  for (const id of facts.keys()) {
    const b = baseOf(id);
    if (b) (users.get(b) ?? users.set(b, []).get(b)!).push(id);
  }
  return {
    baseOf,
    aggregatesOf: (id) => users.get(id) ?? [],
    reaches(from, to) {
      const seen = new Set<Uuid>();
      for (let at = baseOf(from); at && !seen.has(at); at = baseOf(at)) {
        if (at === to) return true;
        seen.add(at);
      }
      return false;
    },
  };
}

/**
 * The facts "Aggregate of" offers a fact (prototype `cubeEntitySection`): the other live facts, in `order`, minus any
 * whose chain of bases reaches this fact (choosing it would close a cycle).
 */
export function baseChoices(index: AggregateIndex, factId: Uuid, order: readonly Uuid[], isFact: (id: Uuid) => boolean): Uuid[] {
  return order.filter((id) => id !== factId && isFact(id) && !index.reaches(id, factId));
}

/** The refusals (approved in step 1). */
export const AGGREGATE_TEXTS = {
  self: "A fact is not an aggregate of itself.",
  notFact: "Choose a fact as the base.",
  cycle: (base: string, fact: string) => `${base} is an aggregate of ${fact}, so ${fact} cannot be an aggregate of it.`,
  undoSelf: (fact: string) => `Undoing this would make ${fact} an aggregate of itself.`,
  undoDeleted: (fact: string) => `Undoing this would make ${fact} an aggregate of a deleted fact.`,
} as const;
