// Copies of attributes (slice 10c, D-63): an attribute pasted from another one keeps a link to it
// (`copied_from_attribute_id`) and follows its data type with its parameters and Personal data. One rule in one place
// (acceptance F1): after any write, every live copy below a written attribute takes its own original's followed fields,
// in the same change group. `updateAttribute` and undo and redo (`revertChangeGroup`) call it.
// The links form a forest by construction (F17: a link is set only on a new row, to a row that exists already); the
// walks keep a visited set anyway.

import { nextVersion, type CommandContext, type Write } from "../changes";
import type { Uuid } from "../ids";
import type { Attribute, Entity, LostOriginal } from "../types";

/** The columns a copy follows (P2): the data type with its parameters, and Personal data. */
export const FOLLOWED_COLUMNS = ["data_type", "custom_type", "type_length", "type_precision", "type_scale", "is_pii"] as const;
type Followed = Pick<Attribute, (typeof FOLLOWED_COLUMNS)[number]>;

const followedOf = (a: Attribute): Followed => Object.fromEntries(FOLLOWED_COLUMNS.map((k) => [k, a[k]])) as Followed;
const sameFollowed = (a: Attribute, b: Attribute) => FOLLOWED_COLUMNS.every((k) => a[k] === b[k]);
const live = (a: Attribute | undefined): a is Attribute => !!a && a.deleted_at === null;

/** Whether a patch of an attribute changes a followed column. */
export const changesFollowed = (patch: Partial<Attribute>): boolean => FOLLOWED_COLUMNS.some((k) => k in patch);

/** The live attributes that point to each attribute, by its id. */
function childrenOf(attributes: Iterable<Attribute>): Map<Uuid, Attribute[]> {
  const out = new Map<Uuid, Attribute[]>();
  for (const a of attributes) {
    if (!live(a) || a.copied_from_attribute_id === null) continue;
    const list = out.get(a.copied_from_attribute_id);
    if (list) list.push(a);
    else out.set(a.copied_from_attribute_id, [a]);
  }
  return out;
}

/** The live copies of an attribute, made from it directly: they lose their original when it goes (F7). */
export const liveCopiesOf = (attributes: readonly Attribute[], id: Uuid): Attribute[] => childrenOf(attributes).get(id) ?? [];

/**
 * Every live copy below an attribute, copies of copies included: the rows a save of its followed fields also writes,
 * held in the browser's save chain (F4).
 */
export function copiesBelow(attributes: readonly Attribute[], id: Uuid): Attribute[] {
  const children = childrenOf(attributes);
  const seen = new Set<Uuid>([id]);
  const out: Attribute[] = [];
  const walk = (from: Uuid) => {
    for (const c of children.get(from) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

/**
 * Brings copies in step after `writes` (F1): every live attribute that the writes wrote or that is a live copy below
 * one of them takes its original's followed fields when its original is live after the writes. A copy whose original
 * is deleted keeps its values (a lost reference follows nothing). A copy the writes already write gets the fields in
 * that write; any other gets an update of its own, its version from `current`. Returns the writes with them, and the
 * ids of the copies that only following wrote (`followers`: the working context leaves them out, F3).
 */
export function followOriginals(ctx: CommandContext, current: readonly Attribute[], writes: readonly Write[]): { writes: Write[]; followers: Uuid[] } {
  const out = [...writes];
  const written = new Map<Uuid, number>();
  out.forEach((w, i) => {
    if (w.table === "attribute") written.set(w.row.id, i);
  });
  if (!written.size) return { writes: out, followers: [] };

  const before = new Map(current.map((a) => [a.id, a]));
  const after = new Map(before);
  for (const i of written.values()) {
    const row = (out[i] as Extract<Write, { table: "attribute" }>).row;
    after.set(row.id, row);
  }

  // the attributes to bring in step: the written ones and every live copy below them
  const children = childrenOf(after.values());
  const targets = new Set<Uuid>();
  const collect = (id: Uuid) => {
    if (targets.has(id)) return;
    targets.add(id);
    for (const c of children.get(id) ?? []) collect(c.id);
  };
  for (const id of written.keys()) collect(id);

  const followers: Uuid[] = [];
  const settled = new Set<Uuid>();
  const settling = new Set<Uuid>();
  // an original before its copies, so that a value reaches copies of copies through the chain
  const settle = (id: Uuid) => {
    if (settled.has(id) || settling.has(id)) return;
    settling.add(id);
    const a = after.get(id);
    const original = a?.copied_from_attribute_id ? after.get(a.copied_from_attribute_id) : undefined;
    if (live(a) && live(original)) {
      if (targets.has(original.id)) settle(original.id);
      const source = after.get(original.id)!;
      if (!sameFollowed(a, source)) {
        const fields = followedOf(source);
        const at = written.get(id);
        let row: Attribute;
        if (at !== undefined) {
          const w = out[at] as Extract<Write, { table: "attribute"; kind: "insert" | "update" }>;
          row = { ...w.row, ...fields };
          out[at] = { ...w, row };
        } else {
          row = nextVersion(ctx, before.get(id)!, fields);
          written.set(id, out.push({ kind: "update", table: "attribute", before: before.get(id)!, row }) - 1);
          followers.push(id);
        }
        after.set(id, row);
      }
    }
    settling.delete(id);
    settled.add(id);
  };
  for (const id of targets) settle(id);
  return { writes: out, followers };
}

// ---- names (panels, refusals, previews) ----

/** "{entity}.{attribute}" of a live attribute, or of a deleted original from the model's `lostOriginals` (F6). */
export function attributePath(id: Uuid, attributes: readonly Attribute[], entities: readonly Entity[], lostOriginals: readonly LostOriginal[] = []): string | null {
  const a = attributes.find((x) => x.id === id);
  if (a) return `${entities.find((e) => e.id === a.entity_id)?.name ?? "?"}.${a.name}`;
  const lost = lostOriginals.find((x) => x.id === id);
  return lost ? `${lost.entityName}.${lost.name}` : null;
}

/** "{entity}.{attribute}" of each attribute, ordered by entity, then attribute (F7). */
export function pathsOf(list: readonly Attribute[], entities: readonly Entity[]): { id: Uuid; label: string }[] {
  const entityName = new Map(entities.map((e) => [e.id, e.name]));
  return list
    .map((a) => ({ id: a.id, entity: entityName.get(a.entity_id) ?? "?", name: a.name }))
    .sort((x, y) => x.entity.localeCompare(y.entity) || x.name.localeCompare(y.name))
    .map((x) => ({ id: x.id, label: `${x.entity}.${x.name}` }));
}

/** At most this many copies are named in a delete's question and in D-47's row; the rest are counted (F7). */
export const COPIES_SHOWN = 5;

/** "A.x, B.x, C.x, D.x, E.x and 3 more" (F7). */
export function namedList(labels: readonly string[], shown = COPIES_SHOWN): string {
  const named = labels.slice(0, shown).join(", ");
  return labels.length > shown ? `${named} and ${labels.length - shown} more` : named;
}

/** The copies' part of a delete's second click (F7): "this copy stops following it: …", "these copies stop following it: …". */
export const copiesStopFollowing = (labels: readonly string[]): string =>
  `${labels.length === 1 ? "this copy stops" : "these copies stop"} following it: ${namedList(labels)}`;

/** The refusal of a followed field on a copy (F5). */
export const FOLLOWS_REFUSAL = (path: string) => `This attribute follows ${path}. Use “Stop following” to change it.`;
/** The same for a copy whose original is deleted (F2, F5). */
export const FOLLOWS_LOST_REFUSAL = (path: string) => `This attribute was copied from ${path}, which was deleted. Use “Stop following” to change it.`;
/** The refusal of a paste whose original is gone (item 4). */
export const COPIED_GONE = "The copied attribute no longer exists.";
