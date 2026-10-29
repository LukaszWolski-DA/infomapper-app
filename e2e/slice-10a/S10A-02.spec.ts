import { expect, test, type Page } from "./fixtures";
import { canvasUrl, ids, lineMenu, loadModel, mappingLine, openCanvas, pointOnLine, recordToasts, signInAs, toasts } from "./helpers";

// The canvas first, then the panel (item 1 a, b): a write from the line's menu on its way, then at once a panel save
// of the same row. Before slice 10a the menu's answer did not reach the chain, so the panel sent an older version.

async function open(page: Page) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
}

test("S10A-02: a status from a mapping line's menu, then at once the mapping's note in its panel: both stored, no toast", async ({ page }) => {
  const { attribute } = await ids();
  const mapping = (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  await open(page);
  const line = mappingLine(page, mapping.id);
  const at = await pointOnLine(line);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(page, line, next);
  const note = page.getByTestId("panel-mapping").locator("#f-note");
  await note.fill("Checked with HR");
  await note.press("Tab");
  await expect
    .poll(async () => (await loadModel()).mappings.find((m) => m.id === mapping.id))
    .toMatchObject({ note_text: "Checked with HR", status: next === "Approved" ? "approved" : "review", version: mapping.version + 2 });
  expect(await toasts(page)).toEqual([]);
});

test("S10A-02: Swap direction from a relationship line's menu, then at once the label in its panel: both stored, no toast", async ({ page }) => {
  await open(page);
  const line = page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').first();
  const id = (await line.getAttribute("data-relationship"))!;
  const before = (await loadModel()).relationships.find((r) => r.id === id)!;
  const at = await pointOnLine(line, 0.3);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
  await lineMenu(page, line, "Swap direction", 0.3);
  const label = page.getByTestId("panel-relationship").getByTestId("input-relationship-label");
  await label.fill("holds");
  await label.press("Enter");
  await expect
    .poll(async () => (await loadModel()).relationships.find((r) => r.id === id))
    .toMatchObject({ label: "holds", from_entity_id: before.to_entity_id, version: before.version + 2 });
  expect(await toasts(page)).toEqual([]);
});
