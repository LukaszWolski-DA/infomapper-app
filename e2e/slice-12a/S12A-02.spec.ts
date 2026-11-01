import { expect, test } from "./fixtures";
import { expectToast, hydrated, loadProject, projectHome, recordToasts, signInAs, STALE, toasts, undoButton } from "./helpers";

// S12A-02 (item 4): a rename undone on the project home shows the old name in the field, the breadcrumbs and the
// switcher, and the versions the undo wrote reach the save chain: the next rename is stored without a conflict.

test("S12A-02: a rename undone on the home: the field, the breadcrumbs and the switcher show the old name; a new rename is stored", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  await name.fill("Customer 360 – 2026");
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");
  await expect(page.getByTestId("switcher-project")).toHaveText("Customer 360 – 2026");

  await undoButton(page).click();
  await expectToast(page, "Undone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360");
  await expect(name).toHaveValue("Customer 360");
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360");
  await expect(page.getByTestId("nav-breadcrumbs")).not.toContainText("2026");
  await expect(page.getByTestId("switcher-project")).toHaveText("Customer 360");

  // right after it, a new rename goes through (the undo's version reached `rowSaves`)
  await name.fill("Customer 360 B");
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 B");
  await expect(page.getByTestId("switcher-project")).toHaveText("Customer 360 B");
  expect(await toasts(page)).not.toContain(STALE);
});
