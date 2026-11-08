// The bus matrix (slice 15d, B-8 with R-8 and RP-10; prototype `openBusMatrix`): facts with their grain against
// dimensions with their history (slice 19: SCD 0 to 2 or a snapshot), one dot per relationship between them, filled when an active key carries it. Derived
// from InfoMapper's relationships and InfoCube's rows when the dialog opens (Y5: a snapshot); nothing is stored.

import type { Uuid } from "@/domain/ids";
import type { Concept, Entity } from "@/domain/types";
import { asRole, type CubeIndex } from "./keys";
import { historyLabel } from "./view";

export const BUS_MATRIX_TEXTS = {
  button: "Bus matrix",
  buttonTitle: "Facts × dimensions",
  title: "Bus matrix",
  head: (workspace: string) => `${workspace} · InfoCube`,
  intro:
    "Which dimensions each fact uses. A dimension used by more than one fact is conformed: it must mean the same in all of them. Built from the relationships; click a name or a dot to open it.",
  fact: "Fact",
  grain: "grain",
  noGrain: "no grain",
  usedBy: "Used by",
  facts: (n: number) => `${n} fact${n === 1 ? "" : "s"}`,
  conformed: "conformed",
  unused: "unused",
  legend: "● the fact carries the dimension's key · ○ related, key missing",
  close: "Close",
  empty: "No facts or dimensions yet.",
} as const;

/** One dot: a relationship between a fact and a dimension, and the key that carries it (null: none). */
export interface BusDot {
  relationshipId: Uuid;
  key: string | null;
  /** "Fact Sales uses Dim Date as Order date: date_key" (R-8). */
  title: string;
}

export interface BusMatrix {
  /** The workspace's name, for the dialog's head. */
  workspace: string;
  facts: { id: Uuid; name: string; grain: string | null }[];
  /** `history`: the dimension's history as shown (slice 19: "SCD 1", "Snapshot · Month-end"). */
  dimensions: { id: Uuid; name: string; history: string; facts: number }[];
  /** The dots by fact, then by dimension, in the relationships' order. */
  cells: Record<Uuid, Record<Uuid, BusDot[]>>;
}

/** A dot's title (R-8): the role and the key when there are any. */
export const dotTitle = (fact: string, dimension: string, role: string | null, key: string | null): string =>
  `${fact} uses ${dimension}${asRole(role)}${key ? `: ${key}` : ", but no key carries it"}`;

/**
 * The matrix's rows: facts, then dimensions, as the Cube tab lists them (by concept in the concepts' order, then the
 * model's order of entities). A dimension's count is of facts, not relationships (R-8).
 */
export function busMatrix(
  index: CubeIndex,
  entities: readonly Pick<Entity, "id" | "name" | "concept_id" | "deleted_at">[],
  concepts: readonly Pick<Concept, "id" | "sort_order">[],
  workspace = "",
): BusMatrix {
  const rank = new Map([...concepts].sort((a, b) => a.sort_order - b.sort_order).map((c, i) => [c.id, i]));
  const ordered = entities
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.deleted_at === null)
    .sort((a, b) => (rank.get(a.e.concept_id) ?? rank.size) - (rank.get(b.e.concept_id) ?? rank.size) || a.i - b.i)
    .map(({ e }) => e);
  const facts = ordered.filter((e) => index.roleOf(e.id) === "fact");
  const dimensions = ordered.filter((e) => index.roleOf(e.id) === "dimension");
  const cells: BusMatrix["cells"] = {};
  const users = new Map<Uuid, Set<Uuid>>();
  for (const f of facts) {
    const row: Record<Uuid, BusDot[]> = {};
    for (const k of index.factKeys(f.id)) {
      const key = k.key?.name ?? null;
      (row[k.dimensionId] ??= []).push({ relationshipId: k.relationshipId, key, title: dotTitle(f.name, index.nameOf(k.dimensionId), k.role, key) });
      (users.get(k.dimensionId) ?? users.set(k.dimensionId, new Set()).get(k.dimensionId)!).add(f.id);
    }
    cells[f.id] = row;
  }
  return {
    workspace,
    facts: facts.map((f) => ({ id: f.id, name: f.name, grain: index.cubeOf(f.id)?.grain?.trim() || null })),
    dimensions: dimensions.map((d) => ({ id: d.id, name: d.name, history: historyLabel(index.cubeOf(d.id)), facts: users.get(d.id)?.size ?? 0 })),
    cells,
  };
}
