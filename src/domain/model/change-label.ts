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
  frame: "frame",
  label: "label",
  label_link: "label",
  project_pinned_label: "label pin",
  note: "note",
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
  "frame",
  "canvas_item",
  "label",
  "label_link",
  "project_pinned_label",
  "note",
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
    if (cards.every((e) => only(e, ["width"]))) return cards.length > 1 ? "Resize cards" : "Resize card";
    if (cards.every((e) => only(e, ["collapsed"]))) return cards[0]!.after_image?.collapsed ? "Collapse card" : "Expand card";
    if (cards.every((e) => only(e, ["row_filter"]))) return "Filter card rows";
  }
  if (cards.length === events.length && cards.every((e) => e.operation === "create")) return cards.length > 1 ? `Place ${cards.length} cards` : "Place card";
  // Removed cards free the notes pinned to them in the same group (slice 3a).
  if (cards.length > 1 && cards.length + of("note").length === events.length && cards.every((e) => e.operation === "delete")) return `Remove ${cards.length} cards`;

  // Frames (slice 2b): moved with their cards, cards dropped into frames (which may grow), resized, arranged.
  const frames = of("frame");
  // Collapsed or expanded (slice 2c, D-07): one frame, or all of a canvas.
  if (frames.length && frames.length === events.length && frames.every((e) => e.operation === "update" && only(e, ["collapsed"]))) {
    const collapsed = !!frames[0]!.after_image?.collapsed;
    if (frames.length > 1) return collapsed ? "Collapse all frames" : "Expand all frames";
    return collapsed ? "Collapse frame" : "Expand frame";
  }
  // a moved frame carries its free notes (slice 3a)
  const carriedNotes = of("note");
  if (
    frames.length &&
    frames.length + cards.length + carriedNotes.length === events.length &&
    [...frames, ...cards, ...carriedNotes].every((e) => e.operation === "update") &&
    carriedNotes.every((e) => only(e, ["x", "y"]))
  ) {
    if (frames.every((e) => only(e, ["x", "y"])) && cards.every((e) => only(e, ["x", "y"]))) return frames.length > 1 ? "Move frames" : "Move frame";
    if (frames.every((e) => only(e, ["width", "height"])) && cards.every((e) => only(e, ["frame_id"]))) return "Resize frame";
    if (cards.length && frames.every((e) => only(e, ["x", "y", "width", "height"])) && cards.every((e) => only(e, ["x", "y", "frame_id"]))) {
      return cards.length > 1 ? "Move cards" : "Move card";
    }
  }
  if (cards.length && cards.length === events.length && cards.every((e) => e.operation === "update" && only(e, ["x", "y", "frame_id"]))) {
    return cards.length > 1 ? "Move cards" : "Move card";
  }
  if (frames.filter((e) => e.operation === "create").length > 1) return "Arrange into frames";

  // Labels (slice 3a): put on or taken off an item, with a new label or not.
  const links = of("label_link");
  const labels = of("label");
  if (links.length === 1 && labels.length + links.length === events.length) {
    if (links[0]!.operation === "create") return "Add label";
    if (links[0]!.operation === "delete" && !labels.length) return "Remove label";
  }
  if (labels.length === 1 && labels[0]!.operation === "update" && only(labels[0]!, ["name", "name_key"])) return "Rename label";

  // Notes (slice 3a): one note changed by itself.
  const notes = of("note");
  if (notes.length === 1 && notes.length === events.length) {
    const e = notes[0]!;
    if (e.operation === "create") return "Add note";
    if (e.operation === "delete") return "Delete note";
    if (e.operation === "update") {
      if (only(e, ["status", "resolved_at", "resolved_by"])) return e.after_image?.status === "resolved" ? "Resolve note" : "Reopen note";
      if (only(e, ["body_html", "body_text"])) return "Edit note";
      if (only(e, ["color"])) return "Change note colour";
      if (only(e, ["width"])) return "Resize note";
      if (only(e, ["x", "y", "frame_id"])) return "Move note";
      if (e.after_image?.pin_canvas_item_id || e.after_image?.pin_frame_id) return "Pin note";
      return "Unpin note";
    }
  }

  // A new canvas that comes with cards is a duplicated layout (slice 2a).
  if (of("canvas").some((e) => e.operation === "create") && cards.some((e) => e.operation === "create")) return "Duplicate canvas";

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

/** The canvas a change group's cards, frames and notes are on, when they are all on one; null for a change of the model only. */
export function changeCanvasId(events: readonly ChangeEvent[]): string | null {
  const ids = new Set(
    events
      .filter((e) => e.object_type === "canvas_item" || e.object_type === "frame" || e.object_type === "note")
      .map((e) => String((e.after_image ?? e.before_image)?.canvas_id ?? "")),
  );
  return ids.size === 1 ? [...ids][0]! || null : null;
}
