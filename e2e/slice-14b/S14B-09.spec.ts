import { expect, test, type Page } from "./fixtures";
import {
  answerOf,
  canvasUrl,
  changeEntityAsAnna,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  editNote,
  entityNamed,
  FULL,
  holdUntil,
  hydrated,
  leaveAsks,
  leaveAsksNothing,
  noteEditor,
  noteMark,
  noteWithText,
  notSaved,
  openCanvas,
  openEntityFromTree,
  signInAs,
  useThis,
  WHOLE_CO,
  writeNote,
} from "./helpers";

// S14B-09 (item 8, O5–O6): the page asks for the browser's warning before it is left (here: the tab closed, and once a
// reload) while it has unsaved text: a focused field with typed text, a conflict line, "Not saved", a note's draft, a
// note typed in its editor, a save on its way. It asks nothing once the text is saved or dropped ("Use this", Escape),
// and nothing on a page without drafts.

async function customer(page: Page) {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  return page.getByTestId("panel-entity");
}

test("S14B-09: a focused field with typed text asks; once it is saved, nothing", async ({ page }) => {
  const panel = await customer(page);
  const name = panel.getByTestId("input-entity-name");
  await name.fill("Client");
  await leaveAsks(page);
  const answered = answerOf(page, "Client");
  await name.press("Tab");
  await answered();
  expect((await entityNamed("Client"))?.name).toBe("Client");
  await leaveAsksNothing(page);
});

test("S14B-09: a conflict line asks; after Use this, nothing", async ({ page }) => {
  const panel = await customer(page);
  await changeEntityAsAnna("Customer", { name: "Customer (Anna)" });
  const name = panel.getByTestId("input-entity-name");
  await name.fill("Client");
  await name.press("Tab");
  await expect(conflictLine(panel)).toBeVisible();
  await leaveAsks(page);
  await useThis(panel).click();
  await expect(name).toHaveValue("Customer (Anna)");
  await leaveAsksNothing(page);
});

test("S14B-09: Not saved asks; after Escape, nothing", async ({ page }) => {
  const panel = await customer(page);
  await changeEntityAsAnna("Customer", { stereotype: "context" });
  const alias = panel.getByTestId("input-entity-alias");
  await alias.fill("Klient");
  await alias.press("Tab");
  await expect(notSaved(panel)).toHaveText("Not saved");
  await leaveAsks(page);
  await alias.focus();
  await alias.press("Escape");
  await expect(alias).toHaveValue("");
  await expect(notSaved(panel)).toHaveCount(0);
  await leaveAsksNothing(page);
});

test("S14B-09: a note's refused draft asks; dropped with Escape in its editor, nothing", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await changeNoteAsAnna(note.id, { color: "green" });
  await writeNote(page, note.id, "Mine: nightly at 1 am.");
  await expect(noteMark(page, note.id)).toBeVisible();
  await leaveAsks(page);
  await editNote(page, note.id);
  await page.keyboard.press("Escape");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await leaveAsksNothing(page);
});

test("S14B-09: a note typed in its editor asks; cancelled with Escape, nothing", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await editNote(page, note.id);
  await page.keyboard.type(" And more.");
  await leaveAsks(page);
  await noteEditor(page).press("Escape");
  await expect(noteEditor(page)).toHaveCount(0);
  await leaveAsksNothing(page);
});

test("S14B-09: a save held on its way asks; after its answer, nothing", async ({ page }) => {
  const panel = await customer(page);
  const hold = await holdUntil(page, "Client held");
  const name = panel.getByTestId("input-entity-name");
  await name.fill("Client held");
  await name.press("Tab");
  await expect.poll(() => hold.held()).toBe(true);
  await leaveAsks(page);
  const answered = answerOf(page, "Client held");
  hold.release();
  await hold.given;
  await answered();
  expect((await entityNamed("Client held"))?.name).toBe("Client held");
  await leaveAsksNothing(page);
});

test("S14B-09: a page without drafts asks nothing", async ({ page }) => {
  const panel = await customer(page);
  // a gesture on the page (the browser asks only after one), and a field visited without typing
  await panel.getByTestId("input-entity-name").click();
  await leaveAsksNothing(page);
});

test("S14B-09: a reload with typed text asks; accepted, the page reloads and the text is gone", async ({ page }) => {
  const panel = await customer(page);
  await panel.getByTestId("input-entity-name").fill("Client");
  const asked: string[] = [];
  page.once("dialog", (d) => {
    asked.push(d.type());
    void d.accept();
  });
  await page.reload();
  expect(asked).toEqual(["beforeunload"]);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  await expect(page.getByTestId("panel-entity").getByTestId("input-entity-name")).toHaveValue("Customer");
  expect((await entityNamed("Customer"))?.name).toBe("Customer");
});
