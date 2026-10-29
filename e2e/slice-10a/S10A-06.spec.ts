import { expect, test, type Page } from "./fixtures";
import { canvasUrl, ids, lineMenu, loadModel, mappingLine, openCanvas, pointOnLine, recordToasts, rowNamed, signInAs, STALE, toasts } from "./helpers";

// Undo waits for the canvas's writes on the chain (item 6): Ctrl+Z at once undoes the write that was on its way, and
// the next save goes through. This end-to-end proof would pass before slice 10a too, through Next.js's sequential
// dispatch (F4); the check that fails without the chain is the unit test in `src/ui/row-saves.test.ts`. Ctrl+Z does
// nothing while the page shows nothing to undo (slice 1b, as the prototype), so each case first makes a step and waits
// for the page to show it, as S9-05 does.

const undoReady = (page: Page) => expect(page.getByTestId("button-undo")).toBeEnabled();

test("S10A-06: a status from the line's menu, then Ctrl+Z at once: the status change is undone, and the next save is stored", async ({ page }) => {
  const { attribute } = await ids();
  const mapping = (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const line = mappingLine(page, mapping.id);
  const at = await pointOnLine(line);
  await page.mouse.click(at.x, at.y);
  const note = page.getByTestId("panel-mapping").locator("#f-note");
  await note.fill("Before the status");
  await note.press("Tab");
  await undoReady(page);

  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(page, line, next);
  await page.keyboard.press("Control+z");
  await note.fill("After the undo");
  await note.press("Tab");
  // the note (+1), the status (+1), its undo (+1), the note again (+1)
  await expect.poll(async () => (await loadModel()).mappings.find((m) => m.id === mapping.id)).toMatchObject({ status: mapping.status, note_text: "After the undo", version: mapping.version + 4 });
  const seen = await toasts(page);
  expect(seen).not.toContain(STALE);
  expect(seen.some((t) => t.startsWith("Undone"))).toBe(true);
});

test("S10A-06: Ctrl+↓ on a row, then Ctrl+Z at once: the siblings' order is restored, and a sibling's save after it is stored", async ({ page }) => {
  const line = (await ids()).entity("Order Line");
  const order = async () =>
    (await loadModel()).attributes
      .filter((a) => a.entity_id === line.id && a.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((a) => a.name);
  const start = await order();
  const [first, second] = start as [string, string];
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  const name = page.getByTestId("input-attribute-name");
  await rowNamed(page, "Order Line", second).click();
  await name.fill(`${second}_a`);
  await name.press("Enter");
  await undoReady(page);

  await rowNamed(page, "Order Line", first).click();
  await page.keyboard.press("Control+ArrowDown");
  await page.keyboard.press("Control+z");
  await rowNamed(page, "Order Line", `${second}_a`).click();
  await name.fill(`${second}_b`);
  await name.press("Enter");
  await expect.poll(order).toEqual([first, `${second}_b`, ...start.slice(2)]);
  const seen = await toasts(page);
  expect(seen).not.toContain(STALE);
  expect(seen.some((t) => t.startsWith("Undone"))).toBe(true);
});
