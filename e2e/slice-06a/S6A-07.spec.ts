// S6A-07 (slice 6a, item 8; Łukasz's step 1 answer 8): the status bar has no Focus chip any more (it is in the
// view-state bar) and follows Requirements with “Open notes on canvas {n}”, counting open notes only, as the prototype:
// resolved ones never, hidden or shown. Customer & orders has two open notes and one resolved.

import { expect, test } from "./fixtures";
import { canvasUrl, DEMO_NOTES, noteEl, openCanvas, signInAs, viewBar, WHOLE_CO } from "./helpers";

test("S6A-07: the status bar counts the canvas's open notes and has no Focus chip", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 }); // the resolved note clear of the Overview
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const status = page.getByTestId("bar-status");
  const notes = page.getByTestId("status-notes");
  await expect(notes).toHaveText("Open notes on canvas 2");
  // after Requirements (the working context is off)
  expect(await status.locator(":scope > span").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual([
    "status-mapped",
    "status-mappings",
    "status-type-problems",
    "status-relationships",
    "status-requirements",
    "status-notes",
  ]);

  await page.getByTestId("button-focus").click();
  await expect(viewBar(page).getByTestId("chip-focus")).toBeVisible();
  await expect(status.getByTestId("chip-focus")).toHaveCount(0);

  // hiding resolved notes changes nothing; resolving and reopening a note does
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await expect(notes).toHaveText("Open notes on canvas 2");
  await page.getByTestId("checkbox-show-resolved").check();
  await noteEl(page, DEMO_NOTES.free).getByTestId("button-note-resolve").click();
  await expect(notes).toHaveText("Open notes on canvas 1");
  await noteEl(page, DEMO_NOTES.resolved).getByTestId("button-note-resolve").click();
  await expect(notes).toHaveText("Open notes on canvas 2");

  // after a reload the page's count and the canvas's agree
  await page.reload();
  await expect(notes).toHaveText("Open notes on canvas 2");
});
