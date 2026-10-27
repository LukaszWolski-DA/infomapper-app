// S7C-02: the upgrade. A data file as slice 7b wrote it (format 7: the business key and personal data flags on the
// columns, no classifications, no notes) is upgraded on the server's first read: every flag becomes a Business key or
// Personal data link, and the BK badge on source rows, the Keys filter, the business key suggestion on attributes and
// the column panel show what they showed before; a hand-typed column comment moves into the column's note, listed in
// the upgrade's report (column paths only). The unit test on a format-7 file is `src/data/local/upgrade-8.test.ts`.

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { E2E_DB } from "../config";
import { card } from "../slice-01a/helpers";
import { setCard } from "../slice-06a/helpers";
import { expect, test } from "./fixtures";
import { canvasUrl, classesOf, columnId, expectPressed, loadModel, openColumn } from "./helpers";
import { openCanvas } from "../slice-01a/helpers";

const TYPED = "Typed by hand <b>not markup</b>";
const REPORT = path.join(path.dirname(E2E_DB), `upgrade-8-${path.basename(E2E_DB, ".json")}.txt`);

type Row = Record<string, unknown>;
/** The e2e data file as slice 7b wrote it (format 7), with a hand-typed comment on `customers.segment`. */
function asFormat7(segmentId: string) {
  const db = JSON.parse(fs.readFileSync(E2E_DB, "utf8")) as Record<string, unknown> & { classification: Row[]; classification_link: Row[]; change_event: Row[]; source_table: Row[]; source_column: Row[] };
  const code = new Map(db.classification.map((c) => [c.id, c.code]));
  const flags = new Map<unknown, Set<unknown>>();
  for (const l of db.classification_link.filter((l) => l.deleted_at === null && l.source_column_id)) {
    if (!flags.has(l.source_column_id)) flags.set(l.source_column_id, new Set());
    flags.get(l.source_column_id)!.add(code.get(l.classification_id));
  }
  const strip = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "note_html" && k !== "note_text"));
  db.format = 7;
  db.source_table = db.source_table.map(strip);
  db.source_column = db.source_column.map((c) => ({
    ...strip(c),
    is_business_key: flags.get(c.id)?.has("BK") ?? false,
    is_pii: flags.get(c.id)?.has("PII") ?? false,
    ...(c.id === segmentId ? { comment: TYPED } : {}),
  }));
  db.change_event = db.change_event.filter((e) => e.object_type !== "classification" && e.object_type !== "classification_link");
  delete (db as Partial<typeof db>).classification;
  delete (db as Partial<typeof db>).classification_link;
  fs.writeFileSync(E2E_DB, JSON.stringify(db));
}

/** What the canvas and the panels show of the flags: the customers card under the Keys filter, its BK badges, the
 * business key suggestion on customer_number, and cust_no's and fname's pressed toggles. */
async function whatShows(page: Page) {
  const customers = card(page, "customers");
  await expect(customers).toBeVisible();
  const rows = await customers.locator("[data-row]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row));
  const badges = await customers.locator("[data-row]:has(.tag.bk)").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row));
  const customerNumber = (await loadModel()).attributes.find((a) => a.name === "customer_number")!.id;
  await openCanvas(page, `${canvasUrl()}?row=${customerNumber}`);
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  const suggestion = await page.getByTestId("note-bk-suggestion").count();
  return { rows, badges, suggestion };
}

test("S7C-02: a format-7 file's flags become classifications and show as before; a hand-typed comment moves into the note", async ({ page }) => {
  await setCard("customers", { rowFilter: "keys" });
  const custNo = await columnId("customers", "cust_no");
  const fname = await columnId("customers", "fname");
  const segment = await columnId("customers", "segment");

  // before: the file as the seed writes it (format 8)
  await openColumn(page, "customers", "cust_no");
  const before = await whatShows(page);
  expect(before.badges).toEqual([custNo]);
  expect(before.suggestion).toBe(1);

  // the same data as slice 7b wrote it, read again by the server
  fs.rmSync(REPORT, { force: true });
  asFormat7(segment);
  // the page first, so the server is the first to read the old file (signed in already)
  await openCanvas(page, `${canvasUrl()}?row=${custNo}`);
  await expect(page.getByTestId("panel-source-column").locator("h2")).toHaveText("cust_no");
  expect(fs.existsSync(REPORT)).toBe(true);
  expect(await whatShows(page)).toEqual(before);
  expect((JSON.parse(fs.readFileSync(E2E_DB, "utf8")) as { format: number }).format).toBe(8);
  expect(await classesOf(custNo)).toEqual(["BK"]);
  expect(await classesOf(fname)).toEqual(["PII"]);

  // the column panels: Business key and Personal data pressed as the flags were
  await openColumn(page, "customers", "cust_no");
  await expectPressed(page, "Business key", true);
  await expectPressed(page, "Personal data", false);
  await openColumn(page, "customers", "fname");
  await expectPressed(page, "Personal data", true);
  await expectPressed(page, "Business key", false);

  // the hand-typed comment is the note now; the source's comment is empty
  await openColumn(page, "customers", "segment");
  await expect(page.getByTestId("input-source-note")).toHaveValue(TYPED);
  await expect(page.getByTestId("panel-source-column")).not.toContainText("From the source:");
  const stored = (await loadModel()).sourceColumns.find((c) => c.id === segment)!;
  expect(stored).toMatchObject({ comment: null, note_text: TYPED });
  expect(stored.note_html).not.toContain("<b>");

  // the report lists the column, never the comment's text
  const report = fs.readFileSync(REPORT, "utf8");
  expect(report).toContain("customers.segment");
  expect(report).not.toContain("Typed by hand");
});
