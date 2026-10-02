"use client";

import { useSyncExternalStore } from "react";
import { getData } from "@/data/generate";

/*
 * Row highlight / Focus (C-10), kept outside React Flow's node and edge arrays.
 * Hovering or selecting a row lights its lines and the rows at the other end; everything else fades.
 * Each card and line subscribes with a selector that returns a string, so only the ones whose
 * state actually changes re-render on hover.
 */

interface Related { maps: Set<string>; rels: Set<string>; rows: Set<string>; cards: Set<string> }

let hover: string | null = null; // row id
let selected: string | null = null; // row id
let active: Related | null = null;
const listeners = new Set<() => void>();

let index: Map<string, { id: string; srcCard: string; column: string; entCard: string; attribute: string }[]> | null = null;
const mapsOfRow = (row: string) => {
  if (!index) {
    index = new Map();
    for (const m of getData().mappings) {
      for (const k of [m.column, m.attribute]) (index.get(k) ?? index.set(k, []).get(k)!).push(m);
    }
  }
  return index.get(row) ?? [];
};

function relatedOf(row: string, card: string): Related {
  const out: Related = { maps: new Set(), rels: new Set(), rows: new Set([row]), cards: new Set([card]) };
  for (const m of mapsOfRow(row)) {
    out.maps.add(m.id);
    out.rows.add(m.column); out.rows.add(m.attribute);
    out.cards.add(m.srcCard); out.cards.add(m.entCard);
  }
  return out;
}

const rowCard = (row: string) => row.split(":").slice(0, 2).join(":"); // "src:12:c3" → "src:12"

function update() {
  const row = hover ?? selected;
  active = row ? relatedOf(row, rowCard(row)) : null;
  listeners.forEach(l => l());
}

export function setHoverRow(row: string | null) {
  if (row === hover) return;
  hover = row;
  update();
}
export function toggleSelectedRow(row: string | null) {
  selected = row === selected ? null : row;
  update();
}
export const getSelectedRow = () => selected;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** true while a row is hovered or selected; the canvas root then fades everything not marked as lit. */
export function useFocusActive() {
  return useSyncExternalStore(subscribe, () => active !== null, () => false);
}

/** "hl" when the line is part of the focus, else "" (fading comes from the root class). */
export function useLineHl(ids: string | string[]) {
  return useSyncExternalStore(subscribe, () => {
    if (!active) return "";
    const list = typeof ids === "string" ? [ids] : ids;
    return list.some(id => active!.maps.has(id) || active!.rels.has(id)) ? "hl" : "";
  }, () => "");
}

/** "" for cards outside the focus (they fade via CSS, no re-render), else "on:<row>,<row>" with the selected row marked "*". */
export function useCardHl(cardId: string) {
  return useSyncExternalStore(subscribe, () => {
    if (!active || !active.cards.has(cardId)) return "";
    const rows = [...active.rows].filter(r => rowCard(r) === cardId);
    return "on:" + rows.map(r => (r === selected ? "*" + r : r)).join(",");
  }, () => "");
}
