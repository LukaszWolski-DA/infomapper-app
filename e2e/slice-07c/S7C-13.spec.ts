// S7C-13: roles and archive: the list, the toggles and the notes are read-only for a reviewer, a reader and in an
// archived workspace (item 12, items 13–15); the server refuses each forbidden write.

import { expect, test } from "./fixtures";
import { archive, callActionDirectly, captureActionId, classesOf, columnId, expectToast, loadModel, openColumn, openList, RETAIL, toggle } from "./helpers";

test("S7C-13: a reviewer and a reader see the list, the toggles and the note read-only; the server refuses their writes", async ({ page, browser }) => {
  // Łukasz's writes give the actions' ids
  await openColumn(page, "customers", "segment");
  const segment = await columnId("customers", "segment");
  const toggleId = await captureActionId(page, () => toggle(page, "Technical / audit").click());
  await expect(toggle(page, "Technical / audit")).toHaveAttribute("aria-pressed", "true");
  const note = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await note.fill("First");
  const noteId = await captureActionId(page, () => note.blur());
  await expectToast(page, "Note saved on segment");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  await dialog.getByTestId("input-new-column-classification").fill("Hash candidate");
  const addId = await captureActionId(page, () => dialog.getByTestId("button-add-column-classification").click());
  await expect.poll(async () => (await loadModel()).classifications.filter((c) => c.name === "Hash candidate")).toHaveLength(1);
  const before = await loadModel();
  const tech = before.classifications.find((c) => c.code === "TECH")!;
  const version = before.sourceColumns.find((c) => c.id === segment)!.version;

  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const other = await browser.newPage();
    await openColumn(other, "customers", "segment", name);
    await expect(toggle(other, "Technical / audit")).toBeDisabled();
    await expect(other.getByTestId("panel-source-column").getByTestId("input-source-note")).toHaveAttribute("readonly", "");
    await openList(other);
    const theirs = other.getByTestId("dialog-classifications");
    await expect(theirs.getByTestId("classification-row").first()).toBeVisible();
    await expect(theirs.locator("input, button:not([data-slot='dialog-close'])")).toHaveCount(0);
    // the server refuses the toggle, the note and the list
    await callActionDirectly(other, toggleId, [RETAIL, { classificationId: tech.id, target: { kind: "source_column", id: segment }, on: false }]);
    await callActionDirectly(other, noteId, [RETAIL, { target: { kind: "source_column", id: segment }, expectedVersion: version, note: "Theirs" }]);
    await callActionDirectly(other, addId, [RETAIL, { scope: "column", name: `By ${name}` }]);
    await other.close();
  }
  const after = await loadModel();
  expect(await classesOf(segment)).toEqual(["TECH"]);
  expect(after.sourceColumns.find((c) => c.id === segment)!.note_text).toBe("First");
  expect(after.classifications.filter((c) => c.name.startsWith("By "))).toEqual([]);
});

test("S7C-13: an archived workspace: everything read-only; the server refuses the owner's writes", async ({ page }) => {
  await openColumn(page, "customers", "segment");
  const segment = await columnId("customers", "segment");
  const toggleId = await captureActionId(page, () => toggle(page, "Technical / audit").click());
  await expect(toggle(page, "Technical / audit")).toHaveAttribute("aria-pressed", "true");
  const tech = (await loadModel()).classifications.find((c) => c.code === "TECH")!;
  await archive();
  await page.reload();
  await expect(page.getByTestId("panel-source-column")).toHaveCount(0);
  await openColumn(page, "customers", "segment");
  await expect(toggle(page, "Technical / audit")).toBeDisabled();
  await expect(page.getByTestId("panel-source-column").getByTestId("input-source-note")).toHaveAttribute("readonly", "");
  await openList(page);
  await expect(page.getByTestId("dialog-classifications").locator("input, button:not([data-slot='dialog-close'])")).toHaveCount(0);
  await callActionDirectly(page, toggleId, [RETAIL, { classificationId: tech.id, target: { kind: "source_column", id: segment }, on: false }]);
  expect(await classesOf(segment)).toEqual(["TECH"]);
});
