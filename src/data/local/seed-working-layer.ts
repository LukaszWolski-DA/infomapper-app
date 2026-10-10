// The demo working layer (slice 3a): two labels and three notes in “Retail Co – DWH”, on the model and the cards that
// `addDemoModel` seeds. CR-23 marks Customer, two of its attributes and the second e-mail mapping (as in the
// prototype's seed); JIRA-481 marks the CRM table customers and its column email_addr. On “Customer & orders”: a free
// note, a note pinned to Customer, and a resolved note pinned to web_users.

import type { Uuid } from "@/domain/ids";
import { labelKey, targetColumns, type LabelTarget } from "@/domain/model/labels";
import { NOTE_WIDTH } from "@/domain/model/notes";
import { plainTextPair } from "@/domain/model/plain-text";
import type { Label, LabelLink, Note, NoteColor } from "@/domain/types";
import type { DevDb } from "./schema";
import { seedId } from "./seed-model";

export interface DemoWorkingLayerOptions {
  workspaceId: Uuid;
  /** The canvas “Customer & orders” of the workspace. */
  canvasId: Uuid;
  at: string;
  /** Who made the labels (a modeler). */
  labelAuthorId: Uuid;
  users: { owner: Uuid; modeler: Uuid; reviewer: Uuid };
}

export function addDemoWorkingLayer(db: DevDb, o: DemoWorkingLayerOptions): void {
  const id = (key: string) => seedId(o.workspaceId, key);
  const std = (key: string, by: Uuid) => ({
    id: id(key),
    workspace_id: o.workspaceId,
    version: 1,
    created_at: o.at,
    created_by: by,
    updated_at: o.at,
    updated_by: by,
    deleted_at: null,
  });

  const labels: [name: string, targets: LabelTarget[]][] = [
    [
      "CR-23",
      [
        { kind: "entity", id: id("entity:customer") },
        { kind: "attribute", id: id("attribute:customer.email") },
        { kind: "attribute", id: id("attribute:customer.segment_code") },
        { kind: "mapping", id: id("mapping:webusers.email>customer.email") },
      ],
    ],
    [
      "JIRA-481",
      [
        { kind: "source_table", id: id("table:customers") },
        { kind: "source_column", id: id("column:customers.email_addr") },
      ],
    ],
  ];
  for (const [name, targets] of labels) {
    const label: Label = { ...std(`label:${labelKey(name)}`, o.labelAuthorId), name, name_key: labelKey(name) };
    db.label.push(label);
    for (const target of targets) {
      const link: LabelLink = { ...std(`label_link:${label.name_key}>${target.id}`, o.labelAuthorId), label_id: label.id, ...targetColumns(target) };
      db.label_link.push(link);
    }
  }

  const card = (key: string) => id(`card:${o.canvasId}:${key}`);
  const note = (
    key: string,
    by: Uuid,
    text: string,
    color: NoteColor,
    place: Pick<Note, "x" | "y" | "pin_canvas_item_id">,
    resolvedBy: Uuid | null = null,
  ): Note => {
    const body = plainTextPair(text);
    return {
      ...std(`note:${key}`, by),
      canvas_id: o.canvasId,
      body_html: body.html,
      body_text: body.text,
      color,
      status: resolvedBy ? "resolved" : "open",
      resolved_at: resolvedBy ? o.at : null,
      resolved_by: resolvedBy,
      width: NOTE_WIDTH.initial,
      pin_frame_id: null,
      frame_id: null,
      ...place,
    };
  };
  db.note.push(
    note("free", o.users.owner, "Order lines come from ERP once a night. Check the load window before the go-live.", "blue", {
      x: 1176,
      y: 200,
      pin_canvas_item_id: null,
    }),
    // 280 = the card's default width (256) + 24, as a note pinned from the Note tool.
    note("customer", o.users.reviewer, "Is customer_number the business key in both CRM and the web shop? Confirm with the data owner.", "yellow", {
      x: 280,
      y: 0,
      pin_canvas_item_id: card("entity:customer"),
    }),
    note(
      "webusers",
      o.users.modeler,
      "web_users.email is the second source for e-mail. Priority agreed with the data owner: CRM first.",
      "green",
      { x: 280, y: 0, pin_canvas_item_id: card("table:webusers") },
      o.users.owner,
    ),
  );
}
