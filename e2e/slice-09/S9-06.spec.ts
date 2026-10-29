import { expect, test } from "./fixtures";
import { C360, groupsOf, loadProject, projectHome, recordToasts, RETAIL, signInAs, toasts, hydrated } from "./helpers";

// The project's name on its home (D-59): Enter saves it; the breadcrumbs, the switcher and the workspace home show it;
// one change event in one change group. An empty name goes back with D-59 (ii)'s toast. No length rule, and another
// project's name is fine (item 10, F9).

test("S9-06: the project's name: Enter saves it everywhere, in one change group; an empty name goes back with a toast", async ({ page }) => {
  const before = await loadProject();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  await expect(name).toHaveValue("Customer 360");
  await expect(name).toHaveAttribute("aria-label", "Project name");

  await name.fill("  Customer 360 – 2026 ");
  await name.press("Enter");
  await expect.poll(async () => loadProject()).toMatchObject({ name: "Customer 360 – 2026", version: before.version + 1 });
  const groups = await groupsOf(C360);
  expect(groups).toHaveLength(1);
  expect(groups[0]!.after).toMatchObject({ name: "Customer 360 – 2026" });
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Customer 360 – 2026");
  await expect(page.getByTestId("switcher-project")).toHaveText("Customer 360 – 2026");
  expect(await toasts(page)).toEqual([]);

  // empty: the field goes back, D-59 (ii)'s toast, nothing stored
  await name.fill("   ");
  await name.press("Enter");
  await expect.poll(async () => toasts(page)).toEqual(["A project needs a name."]);
  await expect(name).toHaveValue("Customer 360 – 2026");
  expect(await groupsOf(C360)).toHaveLength(1);

  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("tile-project").filter({ hasText: "Customer 360 – 2026" })).toBeVisible();
});

test("S9-06: no length rule, and another project's name is fine", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  const long = "Customer 360 ".repeat(20).trim();
  await name.fill(long);
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe(long);
  await expect(name).toHaveValue(long);
  await name.fill("Order management");
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Order management");
});
