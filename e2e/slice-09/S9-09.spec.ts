import { expect, test } from "./fixtures";
import { canvasUrl, hydrated, loadProject, openCanvas, projectHome, recordToasts, SEED_IDS, signInAs, toasts } from "./helpers";

// Undo (D-59 (iii)): renaming a project and changing its description are undo steps, as renaming a canvas, in the person's
// history of the workspace; the home pages have no undo, so they are undone and redone from any canvas of the workspace.

test("S9-09: a renaming and a description on the home are undone from a canvas, newest first, from any canvas of the workspace", async ({ page }) => {
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

  // the history is the person's in the workspace: a canvas of another project undoes it too
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer across CRM and the web shop.");
  await expect.poll(async () => toasts(page)).toContain("Undone: Change project description");
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await loadProject()).description).toBe("Changed.");
  await expect.poll(async () => toasts(page)).toContain("Redone: Change project description");

  await openCanvas(page, canvasUrl());
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360 – 2026");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer across CRM and the web shop.");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360");
  await expect.poll(async () => toasts(page)).toContainEqual(expect.stringContaining("Undone: Rename project"));
  await expect(page.getByTestId("nav-breadcrumbs")).not.toContainText("2026");
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360");
});
