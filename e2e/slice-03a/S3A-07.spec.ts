import { expect, test } from "./fixtures";
import { box, DEMO_NOTES, noteEl, notePoint, noteWithText, openCanvas, signInAs, toolboxAt, undo, canvasUrl } from "./helpers";
import type { Page } from "./fixtures";

/** The demo's free note at 80 %. */
const VIEW = { x: -600, y: 0, zoom: 0.8 };
const note = () => noteWithText(DEMO_NOTES.free.slice(0, 12)).then((n) => n ?? noteWithText("Edited"));
const saved = async () => (await note())!;
const menuItem = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name });

test("S3A-07: a note's text is edited in place (Ctrl+Enter saves, Esc cancels), its width changed by its edge, its colour by the toolbox and the panel, and it is resolved and reopened by its ✓, the toolbox and the panel; each change is one undo step", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  const original = await saved();
  const el = noteEl(page, DEMO_NOTES.free);
  await expect(el).toBeVisible();
  const n = page.getByTestId("note").filter({ has: page.locator(`[data-note="${original.id}"]`) }).or(page.locator(`[data-note="${original.id}"]`));

  // text in place: Ctrl+Enter saves, one undo step puts it back; Esc cancels
  let p = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.dblclick(p.x, p.y);
  const input = page.getByTestId("input-note-text");
  await expect(input).toBeFocused();
  await input.fill("Edited in place");
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => (await saved()).body_text).toBe("Edited in place");
  await undo(page);
  await expect.poll(async () => (await saved()).body_text).toBe(original.body_text);
  await expect(n).toContainText(DEMO_NOTES.free);
  await expect(n).not.toContainText("Edited in place");
  p = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.dblclick(p.x, p.y);
  await input.fill("Never saved");
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(n).toContainText(DEMO_NOTES.free);
  expect((await saved()).version).toBe(original.version + 2);

  // the width by the right edge, in steps of 8; one undo step
  const edge = await box(n.getByTestId("note-resize"));
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(edge.x + edge.width / 2 + i * 10, edge.y + edge.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await saved()).width).toBe(320);
  await undo(page);
  await expect.poll(async () => (await saved()).width).toBe(220);
  await expect.poll(async () => Math.round((await box(n)).width / 0.8)).toBe(220);

  // the colour: the toolbox, then the panel; each one undo step
  await toolboxAt(page, await notePoint(page, DEMO_NOTES.free));
  await page.getByTestId("menu-toolbox").getByRole("button", { name: "Pink" }).click();
  await expect.poll(async () => (await saved()).color).toBe("pink");
  await undo(page);
  await expect.poll(async () => (await saved()).color).toBe("blue");
  // the page follows the undo before the next click (it may lag the data)
  await expect(n).toHaveAttribute("data-color", "blue");
  p = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("panel-note")).toBeVisible();
  await page.getByTestId("swatches-note-color").getByRole("button", { name: "Green" }).click();
  await expect.poll(async () => (await saved()).color).toBe("green");
  await expect(n).toHaveAttribute("data-color", "green");
  await undo(page);
  await expect.poll(async () => (await saved()).color).toBe("blue");
  // the page follows the undo before the next click (it may lag the data)
  await expect(n).toHaveAttribute("data-color", "blue");

  // resolved and reopened: its ✓, the toolbox, the panel; each one undo step
  await n.getByTestId("button-note-resolve").click();
  await expect.poll(async () => (await saved()).status).toBe("resolved");
  await expect(n).toHaveAttribute("data-status", "resolved");
  await undo(page);
  await expect.poll(async () => (await saved()).status).toBe("open");
  await expect(n).toHaveAttribute("data-status", "open");
  await toolboxAt(page, await notePoint(page, DEMO_NOTES.free));
  await menuItem(page, "Mark as resolved").click();
  await expect.poll(async () => (await saved()).status).toBe("resolved");
  await expect(n).toHaveAttribute("data-status", "resolved");
  await toolboxAt(page, await notePoint(page, DEMO_NOTES.free));
  await menuItem(page, "Reopen").click();
  await expect.poll(async () => (await saved()).status).toBe("open");
  await expect(n).toHaveAttribute("data-status", "open");
  await undo(page);
  await expect.poll(async () => (await saved()).status).toBe("resolved");
  await expect(n).toHaveAttribute("data-status", "resolved");
  p = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("seg-note-status").getByRole("button", { name: "Open" }).click();
  await expect.poll(async () => (await saved()).status).toBe("open");
  await undo(page);
  await expect.poll(async () => (await saved()).status).toBe("resolved");
});
