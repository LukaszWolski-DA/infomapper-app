import { expect, test, type Page } from "./fixtures";
import { canvasUrl, groupsOf, ids, lineMenu, loadModel, mappingLine, openCanvas, pointOnLine, recordToasts, signInAs, toasts } from "./helpers";

// Panel first, then the canvas (item 1 a, b): a panel save on its way, then at once a write from the line's menu on the
// same row. Before slice 10a the menu sent the version shown before the panel's save came back, and was refused.

async function open(page: Page) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
}

test("S10A-01: a mapping's note in its panel, then at once a status from its line's menu: both stored, no toast, two change groups", async ({ page }) => {
  const { attribute } = await ids();
  const mapping = (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const groups = (await groupsOf(mapping.id)).length;
  await open(page);
  const line = mappingLine(page, mapping.id);
  const at = await pointOnLine(line);
  await page.mouse.click(at.x, at.y);
  const note = page.getByTestId("panel-mapping").locator("#f-note");
  await note.fill("Checked with HR");
  await note.press("Tab");
  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(page, line, next);
  await expect
    .poll(async () => (await loadModel()).mappings.find((m) => m.id === mapping.id))
    .toMatchObject({ note_text: "Checked with HR", status: next === "Approved" ? "approved" : "review", version: mapping.version + 2 });
  expect((await groupsOf(mapping.id)).length).toBe(groups + 2);
  expect(await toasts(page)).toEqual([]);
});

test("S10A-01: a relationship's label in its panel, then at once Swap direction from its line's menu: both stored, no toast, two change groups", async ({ page }) => {
  await open(page);
  const line = page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').first();
  const id = (await line.getAttribute("data-relationship"))!;
  const before = (await loadModel()).relationships.find((r) => r.id === id)!;
  const groups = (await groupsOf(id)).length;
  const at = await pointOnLine(line, 0.3);
  await page.mouse.click(at.x, at.y);
  const label = page.getByTestId("panel-relationship").getByTestId("input-relationship-label");
  await label.fill("holds");
  await label.press("Enter");
  await lineMenu(page, line, "Swap direction", 0.3);
  await expect
    .poll(async () => (await loadModel()).relationships.find((r) => r.id === id))
    .toMatchObject({ label: "holds", from_entity_id: before.to_entity_id, to_entity_id: before.from_entity_id, version: before.version + 2 });
  expect((await groupsOf(id)).length).toBe(groups + 2);
  expect(await toasts(page)).toEqual([]);
});
