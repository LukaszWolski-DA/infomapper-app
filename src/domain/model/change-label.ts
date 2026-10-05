// What a change group did, in a few words, for the undo history's toasts (slice 1b): “Delete mapping”, “Move card”,
// “Reorder attributes”. Read from the group's change events, so every command gets a label without naming one.

import type { ChangeEvent, RowImage } from "../types";

const NOUN: Record<string, string> = {
  project: "project",
  canvas: "canvas",
  project_canvas: "canvas link",
  concept: "concept",
  entity: "entity",
  attribute: "attribute",
  relationship: "relationship",
  source_system: "source system",
  source_table: "source table",
  source_column: "column",
  mapping: "mapping",
  mapping_input: "mapping input",
  canvas_item: "card",
};

/** The table that names a group: the thing the person acted on, not what came along (cascades, a new card). */
const PRIORITY = [
  "concept",
  "entity",
  "source_table",
  "attribute",
  "relationship",
  "mapping",
  "source_column",
  "mapping_input",
  "source_system",
  "canvas",
  "project",
  "project_canvas",
  "canvas_item",
];

const BOOKKEEPING = new Set(["version", "updated_at", "updated_by"]);

/** The columns an update changed, bookkeeping aside. */
function changed(e: ChangeEvent): string[] {
  const a: RowImage = e.before_image ?? {}, b: RowImage = e.after_image ?? {};
  return Object.keys({ ...a, ...b }).filter((k) => !BOOKKEEPING.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

const only = (e: ChangeEvent, columns: readonly string[]) => {
  const c = changed(e);
  return c.length > 0 && c.every((k) => columns.includes(k));
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function changeLabel(events: readonly ChangeEvent[]): string {
  if (events.length === 0) return "Change";
  const of = (table: string) => events.filter((e) => e.object_type === table);

  // Layout: one card changed in place.
  const cards = of("canvas_item");
  if (cards.length === events.length && cards.every((e) => e.operation === "update")) {
    if (cards.every((e) => only(e, ["x", "y"]))) return cards.length > 1 ? "Move cards" : "Move card";
    if (cards.every((e) => only(e, ["width"]))) return "Resize card";
    if (cards.every((e) => only(e, ["collapsed"]))) return cards[0]!.after_image?.collapsed ? "Collapse card" : "Expand card";
    if (cards.every((e) => only(e, ["row_filter"]))) return "Filter card rows";
  }
  if (cards.length === events.length && cards.every((e) => e.operation === "create")) return cards.length > 1 ? `Place ${cards.length} cards` : "Place card";

  // Attribute order (D-36): only sort orders changed.
  const attributes = of("attribute");
  if (attributes.length === events.length && attributes.every((e) => e.operation === "update" && only(e, ["sort_order"]))) return "Reorder attributes";

  // Mappings: status, split and merge (D-49).
  const mappings = of("mapping");
  if (mappings.length === events.length && mappings.every((e) => e.operation === "update" && only(e, ["status", "approved_by", "approved_at"]))) {
    return "Set mapping status";
  }
  const kept = mappings.some((e) => e.operation === "update");
  if (kept && mappings.some((e) => e.operation === "create") && !mappings.some((e) => e.operation === "delete")) return "Split mapping";
  if (kept && mappings.some((e) => e.operation === "delete")) return "Merge mappings";

  const main = PRIORITY.map((t) => events.find((e) => e.object_type === t)).find(Boolean) ?? events[0]!;
  const noun = NOUN[main.object_type] ?? main.object_type;
  if (main.object_type === "canvas_item") return main.operation === "delete" ? "Remove card" : main.operation === "create" ? "Place card" : "Change card";
  switch (main.operation) {
    case "create":
      return `Create ${noun}`;
    case "delete":
      return `Delete ${noun}`;
    case "restore":
      return `Restore ${noun}`;
    default:
      return only(main, ["name"]) ? `Rename ${noun}` : cap(`change ${noun}`);
  }
}
