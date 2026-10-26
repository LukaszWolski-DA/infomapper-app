// S7C-07: notes on a table and a column; saved, with its toast; Undo; read-only for a reviewer and a reader; markup is
// stored escaped, as a mapping's note (answer F7).

import { expect, test } from "./fixtures";
import { columnId, expectToast, loadModel, openColumn, openTable, undo } from "./helpers";

const noteOf = async (id: string) => {
  const m = await loadModel();
  const row = m.sourceTables.find((t) => t.id === id) ?? m.sourceColumns.find((c) => c.id === id)!;
  return { html: row.note_html, text: row.note_text };
};

test("S7C-07: a table's and a column's note: saved on leaving the field, its toast, Undo; markup stored escaped", async ({ page }) => {
  await openTable(page, "customers", "cust_no");
  const tableNote = page.getByTestId("panel-source-table").getByTestId("input-source-note");
  await expect(tableNote).toHaveAttribute("placeholder", "What this table holds, who owns it, how it is loaded");
  await expect(page.getByTestId("panel-source-table")).toContainText("Separate from the source’s comment.");
  await tableNote.fill("Owned by the CRM team, loaded nightly.");
  await tableNote.blur();
  await expectToast(page, "Note saved on customers");
  const customers = (await loadModel()).sourceTables.find((t) => t.name === "customers")!.id;
  await expect.poll(() => noteOf(customers)).toEqual({ text: "Owned by the CRM team, loaded nightly.", html: "<p>Owned by the CRM team, loaded nightly.</p>" });
  await undo(page);
  await expect.poll(() => noteOf(customers)).toEqual({ text: null, html: null });

  await page.getByTestId("panel-source-table").getByTestId("list-table-columns").getByText("cust_no", { exact: true }).click();
  const columnNote = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await expect(columnNote).toHaveAttribute("placeholder", "What a modeller should know: meaning, quirks, which values to expect");
  await columnNote.fill("Values <b>like</b> C-00012 & sometimes blank");
  await columnNote.blur();
  await expectToast(page, "Note saved on cust_no");
  const custNo = await columnId("customers", "cust_no");
  await expect.poll(() => noteOf(custNo)).toEqual({ text: "Values <b>like</b> C-00012 & sometimes blank", html: "<p>Values &lt;b&gt;like&lt;/b&gt; C-00012 &amp; sometimes blank</p>" });
  await expect(columnNote).toHaveValue("Values <b>like</b> C-00012 & sometimes blank");
  // the field shows the stored version before the next edit (it is drawn again with it)
  await expect(columnNote).toHaveAttribute("data-version", "2");
  // cleared: removed
  await columnNote.fill("");
  await columnNote.blur();
  await expectToast(page, "Note removed from cust_no");
  await expect.poll(() => noteOf(custNo)).toEqual({ text: null, html: null });
});

test("S7C-07: read-only for a reviewer and a reader", async ({ browser, page }) => {
  await openColumn(page, "customers", "cust_no");
  const note = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await note.fill("Checked with the CRM team");
  await note.blur();
  await expectToast(page, "Note saved on cust_no");
  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const other = await browser.newPage();
    await openColumn(other, "customers", "cust_no", name);
    const theirs = other.getByTestId("panel-source-column").getByTestId("input-source-note");
    await expect(theirs).toHaveValue("Checked with the CRM team");
    await expect(theirs).toHaveAttribute("readonly", "");
    await other.close();
  }
});
