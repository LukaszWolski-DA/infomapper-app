import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeFrameAsAnna,
  changeNoteAsAnna,
  DEMO_NOTES,
  expectToast,
  FRAMED,
  frameRow,
  hydrated,
  loadModel,
  makeFrame,
  noteBox,
  noteRow,
  noteWithText,
  openCanvas,
  openFrame,
  recordToasts,
  selectNote,
  signInAs,
  STALE,
  WHOLE_CO,
} from "./helpers";

// S14A-08 (items 10, 14, N3, F8): choice fields after a refusal show the newest stored value with the toast, not the
// earlier one: a note's colour (Anna chose green; this page's pink is refused) and a frame's kind (Anna made it a concept
// frame; this page's "Source system" is refused).

test("S14A-08: a note's colour refused: the panel and the canvas show Anna's colour, with the toast", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await selectNote(page, note.id);
  const swatches = page.getByTestId("panel-note").getByTestId("swatches-note-color");

  await changeNoteAsAnna(note.id, { color: "green" });
  await swatches.getByRole("button", { name: "Pink" }).click();
  await expectToast(page, STALE);
  await expect(swatches.getByRole("button", { name: "Green" })).toHaveAttribute("aria-pressed", "true");
  await expect(noteBox(page, note.id)).toHaveAttribute("data-color", "green");
  expect((await noteRow(note.id))!.color).toBe("green");
});

test("S14A-08: a frame's kind refused: the panel shows Anna's kind, with the toast", async ({ page }) => {
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" });
  const customer = (await loadModel()).concepts.find((c) => c.name === "Customer")!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hydrated(page);
  const panel = await openFrame(page, "Area");
  const kind = panel.getByTestId("seg-frame-kind");

  await changeFrameAsAnna(area, { kind: "concept", conceptId: customer.id });
  await kind.getByRole("button", { name: "Source system" }).click();
  await expectToast(page, STALE);
  await expect(kind.getByRole("button", { name: "Concept" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("select-frame-concept")).toHaveValue(customer.id);
  expect((await frameRow(area)).kind).toBe("concept");
});
