// Derivations (slice 18, D-73; prototype `isFed`, `usesCalc`, `calcGaps`, `I.calcUsers`): an attribute, logical or
// dimensional, may be calculated from other attributes of the same entity. The rules live here, in one place:
//
// - the index of calculations: a calculated attribute's live inputs in order, and who reads an attribute;
// - cycles: an attribute's calculation never reads itself, at any depth (`reaches`, `closesCycle`);
// - counting through a calculation: an attribute counts when it counts directly, or when it is calculated, has at least
//   one input and every input counts, recursively, a cycle counting as not (`throughCalculation`). The direct rule is
//   the caller's: "mapped" or "fed" (any mapping, any status; acceptance F1) for the canvas and the counts, D-31's
//   "covered" for requirements (F2);
// - the gaps: the inputs, at any depth, that neither count directly nor are calculated (`calculationGaps`).
//
// An input of another entity, of a deleted attribute, or the attribute itself is not an input (the prototype's `idx`
// drops them): the commands never write one, and a reader never trusts one.

import type { Uuid } from "../ids";
import type { Attribute, AttributeInput } from "../types";

type Live = { deleted_at: string | null };
const live = <T extends Live>(rows: readonly T[]): T[] => rows.filter((r) => r.deleted_at === null);

export interface DerivationIndex {
  /** A live attribute that is calculated (with inputs or none yet). */
  isCalculated: (attributeId: Uuid) => boolean;
  /** A calculated attribute's rule, null when it has none (or is not calculated). */
  ruleOf: (attributeId: Uuid) => string | null;
  /** A calculated attribute's live inputs, in their order; empty for any other attribute. */
  inputsOf: (attributeId: Uuid) => readonly Uuid[];
  /** The live calculated attributes that read this one directly, in model order. */
  usersOf: (attributeId: Uuid) => readonly Uuid[];
  /** Whether `from`'s calculation reads `to`, directly or through other calculations (prototype `usesCalc`). */
  reaches: (from: Uuid, to: Uuid) => boolean;
  /** Whether any attribute is calculated: the readers skip the rest when none is (most models). */
  any: boolean;
}

const NONE: readonly Uuid[] = [];

export function derivationIndex(
  attributes: readonly Pick<Attribute, "id" | "entity_id" | "is_calculated" | "calc_rule" | "deleted_at">[],
  inputs: readonly Pick<AttributeInput, "attribute_id" | "input_attribute_id" | "sort_order" | "deleted_at">[],
): DerivationIndex {
  const byId = new Map(live(attributes).map((a) => [a.id, a]));
  const calculated = new Map<Uuid, { rule: string | null }>();
  for (const a of byId.values()) if (a.is_calculated) calculated.set(a.id, { rule: a.calc_rule ?? null });
  const inputsOf = new Map<Uuid, Uuid[]>();
  const usersOf = new Map<Uuid, Uuid[]>();
  if (calculated.size) {
    const rows = live(inputs)
      .filter((i) => {
        const a = byId.get(i.attribute_id);
        const input = byId.get(i.input_attribute_id);
        return !!a && !!input && calculated.has(a.id) && a.id !== input.id && a.entity_id === input.entity_id;
      })
      .sort((x, y) => x.sort_order - y.sort_order);
    for (const r of rows) {
      const list = inputsOf.get(r.attribute_id);
      if (list) {
        if (!list.includes(r.input_attribute_id)) list.push(r.input_attribute_id);
      } else inputsOf.set(r.attribute_id, [r.input_attribute_id]);
    }
    const order = new Map([...byId.keys()].map((id, i) => [id, i]));
    for (const [user, ins] of inputsOf) for (const i of ins) (usersOf.get(i) ?? usersOf.set(i, []).get(i)!).push(user);
    for (const list of usersOf.values()) list.sort((a, b) => order.get(a)! - order.get(b)!);
  }
  const reaches = (from: Uuid, to: Uuid): boolean => {
    const seen = new Set<Uuid>();
    const walk = (id: Uuid): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      return (inputsOf.get(id) ?? NONE).some((f) => f === to || walk(f));
    };
    return walk(from);
  };
  return {
    isCalculated: (id) => calculated.has(id),
    ruleOf: (id) => calculated.get(id)?.rule ?? null,
    inputsOf: (id) => inputsOf.get(id) ?? NONE,
    usersOf: (id) => usersOf.get(id) ?? NONE,
    reaches,
    any: calculated.size > 0,
  };
}

/**
 * Whether making `attributeId` read `inputId` would close a cycle: the input is the attribute itself, or the input's
 * calculation already reads the attribute at some depth.
 */
export const closesCycle = (index: DerivationIndex, attributeId: Uuid, inputId: Uuid): boolean =>
  attributeId === inputId || index.reaches(inputId, attributeId);

/**
 * The rule "it counts directly, or through its calculation" as a memoised predicate. `direct` is the caller's rule. A
 * calculated attribute without inputs does not count through its calculation; a cycle counts as not counting.
 */
export function throughCalculation(index: DerivationIndex, direct: (attributeId: Uuid) => boolean): (attributeId: Uuid) => boolean {
  const memo = new Map<Uuid, boolean>();
  const visiting = new Set<Uuid>();
  const counts = (id: Uuid): boolean => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (direct(id)) {
      memo.set(id, true);
      return true;
    }
    if (!index.isCalculated(id) || visiting.has(id)) return false;
    const inputs = index.inputsOf(id);
    visiting.add(id);
    const result = inputs.length > 0 && inputs.every(counts);
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };
  return counts;
}

/**
 * The inputs, at any depth, that neither count directly nor are calculated (prototype `calcGaps`), in the order they are
 * met; each once. A calculated input with no inputs of its own adds nothing: its own panel says it has none.
 */
export function calculationGaps(index: DerivationIndex, attributeId: Uuid, direct: (attributeId: Uuid) => boolean): Uuid[] {
  const out: Uuid[] = [];
  const seen = new Set<Uuid>([attributeId]);
  const walk = (id: Uuid) => {
    for (const f of index.inputsOf(id)) {
      if (direct(f)) continue;
      if (index.isCalculated(f)) {
        if (!seen.has(f)) {
          seen.add(f);
          walk(f);
        }
      } else if (!out.includes(f)) out.push(f);
    }
  };
  walk(attributeId);
  return out;
}

/** A calculated row that does not count directly: whether it counts through its calculation, and its rule. */
export interface DerivedRow {
  ok: boolean;
  rule: string | null;
  /** The inputs' names, in order, for the dot's title. */
  inputs: readonly string[];
}

/**
 * The calculated attributes among `attributes` that do not count directly, each with whether it counts through its
 * calculation (acceptance F1: the row's square, the counts). An attribute that counts directly is not here: its row is
 * an ordinary mapped or fed row (decision 2a).
 */
export function derivedRows(
  index: DerivationIndex,
  attributes: readonly Pick<Attribute, "id" | "name" | "deleted_at">[],
  direct: (attributeId: Uuid) => boolean,
): Record<Uuid, DerivedRow> {
  const out: Record<Uuid, DerivedRow> = {};
  if (!index.any) return out;
  const names = new Map(live(attributes).map((a) => [a.id, a.name]));
  const counts = throughCalculation(index, direct);
  for (const id of names.keys()) {
    if (!index.isCalculated(id) || direct(id)) continue;
    out[id] = { ok: counts(id), rule: index.ruleOf(id), inputs: index.inputsOf(id).map((f) => names.get(f) ?? "?") };
  }
  return out;
}

/**
 * Whether a row counts as mapped (or fed): a direct mapping or feed, or its filled square, a calculation whose inputs all
 * count (slice 18, F1). The card's count, the Mapped and Not mapped filters and the thumbnails' heights read this.
 */
export const rowCounts = (row: { mappings: number; calc?: { square?: "ok" | "gap" } }): boolean => row.mappings > 0 || row.calc?.square === "ok";

/**
 * Whether an attribute counts as mapped (or fed) by the same rule as its row (`rowCounts`), from the model: `direct` is
 * the caller's (a source mapping for a logical attribute, a module's feed for a dimensional one). Memoised; build it once
 * per count. The Overview, the status bar, the project home and the frames read it through their rows or this.
 */
export const countsAsMapped = (index: DerivationIndex, direct: (attributeId: Uuid) => boolean): ((attributeId: Uuid) => boolean) =>
  index.any ? throughCalculation(index, direct) : direct;

// ---- texts (approved in step 1, answer 6: "covered" is D-31's word, never a calculation's) ----

/** The row dot's title for a row counted through its calculation, or not yet (prototype `attrRow`). */
export function derivedRowTitle(row: DerivedRow, word: "mapped" | "fed"): string {
  if (!row.inputs.length) return "Calculated from no attributes yet";
  return `Calculated from ${row.inputs.join(", ")}${row.ok ? `: every input is ${word}` : `: not every input is ${word} yet`}`;
}

/** The row mark's title: the rule. */
export const calcMarkTitle = (rule: string | null): string => `Calculated: ${rule?.trim() ? rule : "no rule yet"}`;
