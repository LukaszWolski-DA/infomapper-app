// Model checks on the canvas (slice 20, PRD items 3–5, Z1–Z6; Łukasz's step 2 decisions): the page's one requirement
// index and its check index, provided by the app once per data version (`ModulesProvider`), read here without knowing
// a module. A card's marks are classes on existing elements, kept in its node's data (`check`) only when it has one;
// a card draws again only when its marks change (as the requirement marker, slice 4b-1). Titles are built when the
// pointer is over a mark, from `checksNow`, never in a render.

import { createContext } from "react";
import type { Uuid } from "@/domain/ids";
import { markTitle, type CheckIndex, type CheckMarkInfo } from "@/domain/model/checks";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import { createValueStore } from "./value-store";

/** The page's requirement index, shared by the canvas, the details panel, the status bar and the checks; null: none. */
export const RequirementIndexCtx = createContext<RequirementIndex | null>(null);
/** The page's check index; null without one (a page without the checks). */
export const ChecksCtx = createContext<CheckIndex | null>(null);
/** The same index for what reads it outside a render (a mark's title on hover). */
export const checksNow = createValueStore<CheckIndex | null>(null);
/** The status bar's count asks the details panel to show its group (a counter, so every click is a new request). */
export const checksJump = createValueStore(0);
/** The last request the details panel's group has acted on: a group that mounts after the click still acts on it. */
export const checksJumpHandled = createValueStore(0);

/** A card's marks: the header's, and its rows' by attribute id; `key` tells whether they changed. */
export interface CardCheck {
  head?: CheckMarkInfo;
  rows?: Readonly<Record<Uuid, CheckMarkInfo>>;
  key: string;
}

const markKey = (m: CheckMarkInfo) => `${m.high ? "h" : "n"}${m.n}:${m.groups.join(",")}`;

/** The marks of an entity card, or undefined without any. */
export function cardCheck(index: CheckIndex | null, card: { kind: "ent" | "src"; targetId: Uuid; rows: readonly { id: Uuid }[] }): CardCheck | undefined {
  if (!index || card.kind !== "ent") return undefined;
  const head = index.entityMark(card.targetId);
  if (!head) return undefined; // a row's mark always marks its header too
  let rows: Record<Uuid, CheckMarkInfo> | undefined;
  let key = markKey(head);
  for (const r of card.rows) {
    const m = index.rowMark(r.id);
    if (!m) continue;
    (rows ??= {})[r.id] = m;
    key += `|${r.id}=${markKey(m)}`;
  }
  return { head, ...(rows ? { rows } : {}), key };
}

export const sameCheck = (a: CardCheck | undefined, b: CardCheck | undefined): boolean => a?.key === b?.key;

/** A mark's title, built when the pointer is over it: "Model checks: {n}" and its lines (prototype `chkTitle`). */
export function checkTitle(target: { t: "entity" | "attribute"; id: Uuid }): string {
  const index = checksNow.get();
  if (!index) return "";
  return markTitle(target.t === "entity" ? index.entityItems(target.id) : index.rowItems(target.id));
}
