import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeEntityAsAnna,
  changeTableNoteAsAnna,
  conflictLine,
  entityNamed,
  expectToast,
  FULL,
  groupsOf,
  hydrated,
  keepMine,
  loadModel,
  openCanvas,
  openEntityFromTree,
  openTable,
  otherValue,
  recordToasts,
  signInAs,
  STALE,
  undo,
  useThis,
} from "./helpers";

// S13-03 (items 7, R3, D-66): a conflict in a panel. Anna changes the field as another session; this page's save is
// refused, its fresh page comes with the refusal, and the field keeps the typed text with "Changed meanwhile to: …".
// Leaving the field saves nothing (F6); "Keep mine" stores the draft as one change group and undo step; "Use this"
// takes Anna's value and stores nothing.

test("S13-03: an entity's name: the conflict line, leaving saves nothing, Keep mine stores mine as one undo step; Use this takes Anna's", async ({ page }) => {
  const customer = await entityNamed("Customer");
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const panel = page.getByTestId("panel-entity");
  const name = panel.getByTestId("input-entity-name");

  await changeEntityAsAnna("Customer", { name: "Client" });
  await name.fill("Kunde");
  await name.press("Enter");
  await expectToast(page, STALE);
  await expect(conflictLine(panel)).toContainText("Changed meanwhile to:");
  await expect(otherValue(panel)).toHaveText("Client");
  await expect(name).toHaveValue("Kunde");
  // leaving the field again saves nothing while the line shows
  await name.click();
  await name.press("Enter");
  await page.waitForTimeout(800);
  expect((await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Client");

  await keepMine(panel).click();
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Kunde");
  await expect(conflictLine(panel)).toHaveCount(0);
  const groups = (await groupsOf(customer.id)).filter((g) => g.after?.name !== undefined);
  expect(groups.map((g) => g.after!.name)).toEqual(["Client", "Kunde"]);
  await undo(page);
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Client");
  await expect(name).toHaveValue("Client");

  // a repeat: Use this takes Anna's name and stores nothing
  await changeEntityAsAnna("Client", { name: "Client AG" });
  await name.fill("Kunde AG");
  await name.press("Enter");
  await expect(otherValue(panel)).toHaveText("Client AG");
  const events = (await groupsOf(customer.id)).length;
  await useThis(panel).click();
  await expect(name).toHaveValue("Client AG");
  await expect(conflictLine(panel)).toHaveCount(0);
  await page.waitForTimeout(800);
  expect((await groupsOf(customer.id)).length).toBe(events);
  expect((await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Client AG");
});

test("S13-03: a source table's note: the conflict line; Escape is Use this", async ({ page }) => {
  await recordToasts(page);
  await openTable(page, "customers", "cust_no");
  await hydrated(page);
  const panel = page.getByTestId("panel-source-table");
  const note = panel.getByTestId("input-source-note");

  await changeTableNoteAsAnna("customers", "Anna: loaded hourly.");
  await note.fill("Loaded nightly from the CRM.");
  await note.press("Tab");
  await expectToast(page, STALE);
  await expect(otherValue(panel)).toHaveText("Anna: loaded hourly.");
  await expect(note).toHaveValue("Loaded nightly from the CRM.");
  await note.click();
  await note.press("Escape");
  await expect(note).toHaveValue("Anna: loaded hourly.");
  await expect(conflictLine(panel)).toHaveCount(0);
  expect((await loadModel()).sourceTables.find((t) => t.name === "customers")!.note_text).toBe("Anna: loaded hourly.");
});
