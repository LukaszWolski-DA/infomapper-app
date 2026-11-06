import { expect, test } from "./fixtures";
import { C360, changeProjectAsAnna, expectToast, hydrated, loadProject, projectHome, recordToasts, signInAs, STALE, undoButton } from "./helpers";

// S13-09 (item 3, D-66): a fresh stored value reaches a field that has neither a draft nor the focus; a field with a
// draft keeps it. The page has no polling: another session's write shows with this page's next fresh page, here the
// one a refused save brings (F3, F18).

test("S13-09: an undo on the project home shows the stored name in the field; the description field is not touched", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  const description = page.getByTestId("field-project-description");
  await description.fill("One view of the customer.");
  await description.blur();
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer.");
  await name.fill("Customer 360 – 2026");
  // the data file is written before the answer reaches the page (slice 14b's answerOf): Undo waits for the rename's
  // answer and the page showing its version, or it may come while the rename is still on its way (chore CI e2e)
  const renamed = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && (r.request().postData() ?? "").includes("Customer 360 – 2026"));
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");
  await (await renamed).finished();
  await expect(description).toHaveAttribute("data-version", String((await loadProject()).version));

  await undoButton(page).click();
  await expectToast(page, "Undone: Rename project");
  await expect(name).toHaveValue("Customer 360");
  await expect(description).toHaveValue("One view of the customer.");
});

test("S13-09: another session's change shows in a field without a draft; the refused field keeps its draft and saves it next", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  const description = page.getByTestId("field-project-description");
  const before = (await loadProject()).version;

  await changeProjectAsAnna(C360, { name: "Customer 360 – Anna" }); // the page does not know
  await description.fill("Mine, typed before I saw Anna's change.");
  await description.blur();
  await expectToast(page, STALE);
  // the refusal's fresh page: the name (no draft, no focus) shows Anna's, the description keeps the draft
  await expect(description).toHaveAttribute("data-version", String(before + 1));
  await expect(name).toHaveValue("Customer 360 – Anna");
  await expect(description).toHaveValue("Mine, typed before I saw Anna's change.");
  expect((await loadProject()).description).toBe("One view of the customer across CRM and the web shop.");

  // leaving the field again saves the draft on the newest version
  await description.click();
  await description.blur();
  await expect.poll(async () => (await loadProject()).description).toBe("Mine, typed before I saw Anna's change.");
  expect((await loadProject()).name).toBe("Customer 360 – Anna");
});
