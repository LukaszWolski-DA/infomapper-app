import { expect, test } from "./fixtures";
import { canvasUrl, expectCaretAtEnd, entityNamed, FULL, groupsOf, holdUntil, hydrated, loadModel, openCanvas, openEntityFromTree, openTable, recordToasts, signInAs, toasts, undo } from "./helpers";

// S13-01 (items 3–4, D-66): text typed into a field while its save is on its way stays, with the focus and the caret,
// when the save's answer and fresh page arrive; Enter (or leaving the field) saves the rest after the first save. The
// first save's answer is held until the test releases it (`holdUntil`), so the typing happens inside the round trip.

test("S13-01: an entity's name typed on while its save is on its way: nothing is lost, both saves stored in order", async ({ page }) => {
  const customer = await entityNamed("Customer");
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");

  const hold = await holdUntil(page, '"name":"Customer A"');
  await name.fill("Customer A");
  await name.press("Enter");
  await expect.poll(async () => (await entityNamed("Customer A"))?.id).toBe(customer.id); // written by the server
  expect(hold.held()).toBe(true);

  // back into the field while the answer is held: type on
  await name.click();
  await name.press("End");
  await page.keyboard.type(" Corp");
  hold.release();
  await hold.given;
  // the fresh page has arrived: the card shows the first save's name, the field keeps all the text and the focus
  await expect(page.getByTestId("card-name").getByText("Customer A", { exact: true })).toBeVisible();
  await expect(name).toHaveValue("Customer A Corp");
  await expect(name).toBeFocused();
  await expectCaretAtEnd(name);

  await name.press("Enter");
  await expect.poll(async () => (await entityNamed("Customer A Corp"))?.id).toBe(customer.id);
  const groups = (await groupsOf(customer.id)).filter((g) => g.after?.name !== undefined);
  expect(groups.slice(-2).map((g) => g.after!.name)).toEqual(["Customer A", "Customer A Corp"]);
  expect(new Set(groups.slice(-2).map((g) => g.group)).size).toBe(2);
  expect(await toasts(page)).toEqual([]);

  // two undo steps: the first takes back only the second save
  await undo(page);
  await expect.poll(async () => (await entityNamed("Customer A"))?.id).toBe(customer.id);
});

test("S13-01: a source table's note typed on while its save is on its way: the long text stays and is saved next", async ({ page }) => {
  await recordToasts(page);
  await openTable(page, "customers", "cust_no");
  await hydrated(page);
  const note = page.getByTestId("panel-source-table").getByTestId("input-source-note");
  const before = Number(await note.getAttribute("data-version"));

  const hold = await holdUntil(page, "Loaded nightly from the CRM.");
  await note.fill("Loaded nightly from the CRM.");
  await note.press("Tab"); // leaving the field saves it
  await expect.poll(() => hold.held()).toBe(true);

  await note.click();
  await note.press("Control+End");
  await page.keyboard.type("\nDuplicates come from the web shop.");
  hold.release();
  await hold.given;
  await expect(note).toHaveAttribute("data-version", String(before + 1)); // the first save's fresh page
  await expect(note).toHaveValue("Loaded nightly from the CRM.\nDuplicates come from the web shop.");
  await expect(note).toBeFocused();
  await expectCaretAtEnd(note);

  await note.press("Tab");
  await expect(note).toHaveAttribute("data-version", String(before + 2));
  const table = (await loadModel()).sourceTables.find((t) => t.name === "customers")!;
  expect(table.note_text).toBe("Loaded nightly from the CRM.\nDuplicates come from the web shop.");
  // the two saves' toasts have the same text: the recorder counts a repeated text once
  expect(await toasts(page)).toEqual(["Note saved on customers"]);
});
