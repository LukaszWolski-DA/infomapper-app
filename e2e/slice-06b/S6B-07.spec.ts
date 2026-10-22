// S6B-07 (slice 6b, items 9–10; Q3): the buttons are disabled at the start and at the end of the tab's history and
// enabled once there is somewhere to go; a reload keeps them as they were (the browser keeps the tab's entries); titles
// and accessible names. A fresh tab opened straight on a canvas starts with nowhere to go.

import { expect, test } from "./fixtures";
import { backButton, buttonsEnabled, canvasUrl, expectAt, forwardButton, projectPath, signInAs } from "./helpers";

test("S6B-07: the buttons follow the tab's history, keep their state through a reload, and are named", async ({ page, context }) => {
  await signInAs(page, "Łukasz");
  // a fresh tab, straight on the canvas: nowhere to go
  const tab = await context.newPage();
  await tab.goto(canvasUrl());
  await expect(tab.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(backButton(tab)).toHaveAttribute("title", "Back (Alt+←)");
  await expect(forwardButton(tab)).toHaveAttribute("title", "Forward (Alt+→)");
  await expect(backButton(tab)).toHaveAccessibleName("Back");
  await expect(forwardButton(tab)).toHaveAccessibleName("Forward");
  expect(await buttonsEnabled(tab)).toEqual([false, false]);

  // a breadcrumb to the project home: Back enabled, Forward not
  await tab.getByTestId("breadcrumb").filter({ hasText: "Customer 360" }).click();
  await expectAt(tab, projectPath());
  await expect.poll(() => buttonsEnabled(tab)).toEqual([true, false]);

  // Back: at the start again, Forward enabled
  await backButton(tab).click();
  await expect(tab.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => buttonsEnabled(tab)).toEqual([false, true]);

  // a reload keeps it
  await tab.reload();
  await expect(tab.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => buttonsEnabled(tab)).toEqual([false, true]);
  await forwardButton(tab).click();
  await expectAt(tab, projectPath());
  await expect.poll(() => buttonsEnabled(tab)).toEqual([true, false]);
});
