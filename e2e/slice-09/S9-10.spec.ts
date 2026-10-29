import { expect, test } from "./fixtures";
import { C360, groupsOf, loadProject, projectHome, recordToasts, signInAs, toasts, hydrated } from "./helpers";

// The project home's two fields save one after the other (items 1–3): the name, then at once the description, both
// stored without a toast.

test("S9-10: the name, then at once the description: both stored, no toast", async ({ page }) => {
  const before = await loadProject();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  await page.getByTestId("field-project-name").fill("Customer 360 – 2026");
  await page.getByTestId("field-project-name").press("Tab");
  await expect(page.getByTestId("field-project-description")).toBeFocused();
  await page.getByTestId("field-project-description").fill("Both saved.");
  await page.getByTestId("field-project-description").press("Tab");
  await expect.poll(async () => loadProject()).toMatchObject({ name: "Customer 360 – 2026", description: "Both saved.", version: before.version + 2 });
  expect(await groupsOf(C360)).toHaveLength(2);
  expect(await toasts(page)).toEqual([]);
});
