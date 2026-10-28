// The local data file's upgrade from format 7 (slice 7b) to 8 (slice 7c; S7C-01, S7C-02): a file as slice 7b writes it,
// read through the adapter.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_CLASSIFICATIONS, indexOf } from "@/domain/model/classifications";
import { suggestsBusinessKey } from "@/domain/model/mapping-rules";
import type { ChangeEvent } from "@/domain/types";
import { readDb } from "./file";
import { findViolation } from "./schema";
import { buildSeed, SEED_IDS } from "./seed";
import { seedId } from "./seed-model";
import { createLocalDataStore } from "./store";

const RETAIL = SEED_IDS.wsRetailDwh;
const col = (key: string) => seedId(RETAIL, `column:${key}`);
const AT = "2026-10-20T09:00:00.000Z";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade-8-"));
  file = path.join(dir, "dev-db.json");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

/** The demo seed as slice 7b wrote it: no classification tables, no notes, the two flags on every column. */
function format7(): Record<string, unknown> {
  const db = buildSeed();
  const byId = new Map(db.classification.map((c) => [c.id, c.code]));
  const flagged = new Map<string, Set<string>>();
  for (const l of db.classification_link) {
    const set = flagged.get(l.source_column_id!) ?? flagged.set(l.source_column_id!, new Set()).get(l.source_column_id!)!;
    set.add(byId.get(l.classification_id)!);
  }
  const strip = <R extends object>(rows: R[], keys: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))));
  const old: Record<string, unknown> = {
    ...db,
    format: 7,
    source_table: strip(db.source_table, ["note_html", "note_text"]),
    source_column: strip(db.source_column, ["note_html", "note_text"]).map((c) => ({
      ...c,
      is_business_key: flagged.get(c.id as string)?.has("BK") ?? false,
      is_pii: flagged.get(c.id as string)?.has("PII") ?? false,
    })),
  };
  delete old.classification;
  delete old.classification_link;
  return old;
}

const event = (over: Partial<ChangeEvent>): ChangeEvent => ({
  id: `01900000-0000-7000-8000-ee${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`,
  workspace_id: RETAIL,
  change_group_id: "g",
  occurred_at: AT,
  user_id: SEED_IDS.userLukasz,
  object_type: "source_column",
  object_id: "x",
  operation: "update",
  before_image: {},
  after_image: {},
  context_label_id: null,
  ...over,
});

describe("the upgrade to format 8 (slice 7c)", () => {
  it("writes the 19 built-in classifications in every workspace and turns the flags into links (S7C-01, S7C-02)", async () => {
    await writeFile(file, JSON.stringify(format7()), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = await readDb(file);
    expect(db.format).toBe(9);
    for (const ws of db.workspace) {
      const list = db.classification.filter((c) => c.workspace_id === ws.id);
      expect(list.map((c) => [c.code, c.name, c.scope, c.origin])).toEqual(BUILTIN_CLASSIFICATIONS.map((b) => [b.code, b.name, b.scope, b.origin]));
    }
    expect(db.source_column.every((c) => !("is_business_key" in c) && !("is_pii" in c))).toBe(true);
    expect(db.source_column.every((c) => c.note_html === null && c.note_text === null)).toBe(true);
    expect(db.source_table.every((t) => t.note_html === null && t.note_text === null)).toBe(true);
    expect(findViolation(db)).toBeNull();

    // what the badges, the Keys filter, the attribute suggestion and the column panel read shows what the flags said
    const store = createLocalDataStore(file);
    const model = await store.model.load(RETAIL);
    const classes = indexOf(model);
    expect(model.sourceColumns.filter((c) => classes.has(c.id, "BK")).map((c) => c.name).sort()).toEqual(["cust_no", "cust_no", "item_code", "ord_no"]);
    expect(classes.has(col("customers.fname"), "PII")).toBe(true);
    expect(classes.has(col("customers.segment"), "PII")).toBe(false);
    // (the canvas's BK badge and Keys filter read the same index: src/canvas/canvas.test.ts)
    const customerNumber = model.attributes.find((a) => a.name === "customer_number")!;
    expect(suggestsBusinessKey(customerNumber, [col("customers.cust_no")], classes)).toBe(true);
  });

  it("moves the column comments no import wrote into empty notes, as change events, and lists the columns only (P9, Q4)", async () => {
    const old = format7();
    const columns = old.source_column as Record<string, unknown>[];
    const set = (key: string, comment: string) => (columns.find((c) => c.id === col(key))!.comment = comment);
    set("customers.segment", "Typed by Anna: A, B or C");
    set("customers.dob", "From the CRM catalog");
    set("customers.email_addr", "Imported text");
    set("addr.city", "Typed and deleted");
    columns.find((c) => c.id === col("addr.city"))!.deleted_at = AT;
    const events = old.change_event as ChangeEvent[];
    // an import wrote dob's comment
    events.push(event({ change_group_id: "imp1", object_type: "source_import", object_id: "i1", operation: "create", before_image: null, after_image: {} }));
    events.push(event({ change_group_id: "imp1", object_id: col("customers.dob"), after_image: { comment: "From the CRM catalog" } }));
    // an import wrote email_addr's, a person changed it, and an undo put the import's text back
    events.push(event({ change_group_id: "imp2", object_type: "source_import", object_id: "i2", operation: "create", before_image: null, after_image: {} }));
    events.push(event({ change_group_id: "imp2", object_id: col("customers.email_addr"), after_image: { comment: "Imported text" } }));
    events.push(event({ change_group_id: "hand", object_id: col("customers.email_addr"), after_image: { comment: "Mine" } }));
    events.push(event({ change_group_id: "undo", object_id: col("customers.email_addr"), after_image: { comment: "Imported text" } }));
    // segment: typed by hand (an edit with no import in its group)
    events.push(event({ change_group_id: "hand2", object_id: col("customers.segment"), after_image: { comment: "Typed by Anna: A, B or C" } }));
    await writeFile(file, JSON.stringify(old), "utf8");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const db = await readDb(file);
    const byKey = (key: string) => db.source_column.find((c) => c.id === col(key))!;
    expect(byKey("customers.segment")).toMatchObject({ comment: null, note_text: "Typed by Anna: A, B or C", note_html: "<p>Typed by Anna: A, B or C</p>", version: 2 });
    expect(byKey("customers.dob")).toMatchObject({ comment: "From the CRM catalog", note_text: null });
    expect(byKey("customers.email_addr")).toMatchObject({ comment: "Imported text", note_text: null });
    expect(byKey("addr.city")).toMatchObject({ comment: "Typed and deleted", note_text: null });

    // one change group per workspace, signed by its creator: the classifications, the links, the moved comment
    const upgrade = db.change_event.filter((e) => e.occurred_at !== AT && e.workspace_id === RETAIL && ["classification", "classification_link"].includes(e.object_type) || (e.object_type === "source_column" && e.object_id === col("customers.segment") && e.operation === "update" && e.occurred_at !== AT));
    expect(new Set(upgrade.map((e) => e.change_group_id)).size).toBe(1);
    expect(upgrade.every((e) => e.user_id === db.workspace.find((w) => w.id === RETAIL)!.created_by)).toBe(true);
    const moved = upgrade.find((e) => e.object_type === "source_column")!;
    expect(moved.before_image).toMatchObject({ comment: "Typed by Anna: A, B or C", note_text: null });
    expect(moved.after_image).toMatchObject({ comment: null, note_text: "Typed by Anna: A, B or C" });
    expect(findViolation(db)).toBeNull();

    // the report beside the file names the column, never the comment; one log line
    const report = await readFile(path.join(dir, "upgrade-8-dev-db.txt"), "utf8");
    expect(report).toContain("1 hand-typed column comments moved");
    expect(report).toContain("- Retail Co – DWH: CRM / crmprod.dbo.customers.segment");
    expect(report).not.toContain("Typed by Anna");
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^Slice 7c upgrade: moved 1 hand-typed column comments into notes; see .*upgrade-8-dev-db\.txt$/));

    // written back at once: the next read upgrades nothing again
    log.mockClear();
    const again = await readDb(file);
    expect(again.classification.map((c) => c.id)).toEqual(db.classification.map((c) => c.id));
    expect(log).not.toHaveBeenCalled();
  });

  it("a file with no hand-typed comment says so in its report", async () => {
    await writeFile(file, JSON.stringify(format7()), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    await readDb(file);
    expect(await readFile(path.join(dir, "upgrade-8-dev-db.txt"), "utf8")).toContain("No hand-typed column comment to move.");
  });
});

