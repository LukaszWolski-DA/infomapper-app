import { expect, test } from "./fixtures";
import { loadProject, projectHome, recordToasts, signInAs, toasts, hydrated } from "./helpers";

// The project's description (D-59): plain text with its lines, saved on leaving the field (Enter adds a line), shown
// after a reload; emptied, it is stored as empty (null).

const SEEDED = "One view of the customer across CRM and the web shop.";
const TWO_LINES = "One view of the customer.\nBuilt from the CRM and the web shop.";

test("S9-07: the description keeps its lines, saves on leaving the field and shows after a reload; emptied, it is stored empty", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const description = page.getByTestId("field-project-description");
  await expect(description).toHaveValue(SEEDED);
  await expect(description).toHaveAttribute("placeholder", "What is this project about?");
  await expect(description).toHaveAttribute("aria-label", "Project description");
  const oneLine = (await description.boundingBox())!.height;

  // Enter adds a line and saves nothing; leaving the field saves
  await description.fill("One view of the customer.");
  await description.press("Enter");
  await description.pressSequentially("Built from the CRM and the web shop.");
  expect((await loadProject()).description).toBe(SEEDED);
  await description.press("Tab");
  await expect.poll(async () => (await loadProject()).description).toBe(TWO_LINES);
  // the field grows with its text (CSS, no height read)
  expect((await description.boundingBox())!.height).toBeGreaterThan(oneLine);

  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("field-project-description")).toHaveValue(TWO_LINES);

  await page.getByTestId("field-project-description").fill("");
  await page.getByTestId("field-project-description").press("Tab");
  await expect.poll(async () => (await loadProject()).description).toBeNull();
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("field-project-description")).toHaveValue("");
  expect(await toasts(page)).toEqual([]);
});
