import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, labelNamed, openCanvas, signInAs, WHOLE_CO } from "./helpers";

test("S3B-01: the switch: “Create “cr-99”” from the menu creates the label and turns the context on; the button, the toast and the status bar show it; after a reload it is still on; “Stop working on …” turns it off", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const button = page.getByTestId("button-context");
  await expect(button).toHaveAttribute("aria-pressed", "false");

  // the menu: heading, help, the search field; “Create “cr-99”” first for a name no label has
  await button.click();
  const menu = page.getByTestId("menu-context");
  await expect(menu).toContainText("Working context");
  await expect(menu).toContainText("While a context is on, everything you create or change in the model gets its label, and shows up on its live canvas. Layout changes are not labeled.");
  const input = page.getByTestId("input-context");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("placeholder", "Find or create a label, e.g. CR-23");
  // the labels by items marked, each with its count
  await expect(page.getByTestId("option-context")).toHaveText(["CR-234 items", "JIRA-4812 items"]);
  await input.fill("cr-99");
  await expect(page.getByTestId("option-context-create")).toContainText("Create “cr-99”");
  await input.press("Enter");

  // the label exists, the context is on: button, toast, status bar
  await expect.poll(async () => (await labelNamed("cr-99"))?.name).toBe("cr-99");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toContainText("Working on cr-99");
  await expectToast(page, "Working on cr-99: everything you create or change in the model gets this label. Layout changes don't.");
  await expect(page.getByTestId("status-context")).toHaveText("Working on cr-99, items labeled 0");

  // still on after a reload
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("button-context")).toContainText("Working on cr-99");
  await expect(page.getByTestId("status-context")).toHaveText("Working on cr-99, items labeled 0");

  // the menu lists the active label first; “Stop working on cr-99” turns it off
  await page.getByTestId("button-context").click();
  await expect(page.getByTestId("option-context").first()).toContainText("cr-99active");
  await page.getByTestId("button-context-off").click();
  await expectToast(page, "Working context switched off.");
  await expect(page.getByTestId("button-context")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("status-context")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("button-context")).toHaveAttribute("aria-pressed", "false");
});
