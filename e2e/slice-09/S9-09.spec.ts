import { expect, test } from "./fixtures";
import { canvasUrl, loadProject, openCanvas, projectHome, recordToasts, signInAs, toasts, hydrated } from "./helpers";

// Undo (D-59 (iii)): renaming a project and changing its description are undo steps, as renaming a canvas; the home
// pages have no undo, so they are undone from a canvas of the project.

test("S9-09: a renaming and a description on the home are undone from a canvas, newest first", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  await name.fill("Customer 360 – 2026");
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");
  const description = page.getByTestId("field-project-description");
  await description.fill("Changed.");
  await description.press("Tab");
  await expect.poll(async () => (await loadProject()).description).toBe("Changed.");

  await openCanvas(page, canvasUrl());
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360 – 2026");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer across CRM and the web shop.");
  await expect.poll(async () => toasts(page)).toContainEqual(expect.stringContaining("Undone: Change project"));
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360");
  await expect.poll(async () => toasts(page)).toContainEqual(expect.stringContaining("Undone: Rename project"));
  await expect(page.getByTestId("nav-breadcrumbs")).not.toContainText("2026");
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360");
});
