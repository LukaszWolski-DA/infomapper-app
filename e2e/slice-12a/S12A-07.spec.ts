import { expect, test } from "./fixtures";
import { deleteButton, deleteSection, deleteText, loadProject, OM, OM_HOME, signInAs } from "./helpers";

// S12A-07 (items 8–10, P4): the section at the end of the project home names the canvases deleted with the project and
// those staying in their other projects, with "The model is untouched."; the first click arms the button, which
// disarms as `ConfirmDelete` does (after 4 s, or on blur).

test("S12A-07: the preview names the canvas deleted with the project and the shared one staying; the first click arms, the arm goes as ConfirmDelete's", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await expect(deleteSection(page)).toBeVisible();
  await expect(deleteButton(page)).toHaveText("Delete this project");
  await expect(deleteButton(page)).toBeEnabled();
  await expect(deleteText(page)).toHaveText(
    "The model is untouched. Canvases shared with other projects stay there; canvases only in this project are deleted with it. Deleted with it: Order lines & products. Staying in other projects: Customer & orders.",
  );
  // the section is the page's last
  await expect(page.getByTestId("page-project-home").locator("[data-testid=section-project-delete] ~ *")).toHaveCount(0);

  // the first click arms; 4 s later it disarms by itself
  await deleteButton(page).click();
  await expect(deleteButton(page)).toHaveText("Click again to delete the project");
  await expect(deleteButton(page)).toHaveAttribute("data-armed", "true");
  await expect(deleteButton(page)).toHaveText("Delete this project", { timeout: 6000 });
  // armed again, then a click elsewhere disarms it
  await deleteButton(page).click();
  await expect(deleteButton(page)).toHaveAttribute("data-armed", "true");
  await page.getByTestId("page-project-home").locator("h3").first().click();
  await expect(deleteButton(page)).not.toHaveAttribute("data-armed");
  expect((await loadProject(OM)).deleted_at).toBeNull();
});
