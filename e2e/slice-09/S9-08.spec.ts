import { expect, test } from "./fixtures";
import { archive, C360, callActionDirectly, captureActionId, loadProject, newSession, projectHome, RETAIL, hydrated } from "./helpers";

// Roles and archive (item 13): owners, admins and modelers edit; reviewers and readers see text; the server refuses a
// reviewer's direct call and any write in an archived workspace.

test("S9-08: reviewers and readers see the name and description as text; the server refuses a reviewer's direct call", async ({ browser }) => {
  const owner = await newSession(browser, "Łukasz");
  await owner.page.goto(projectHome());
  await hydrated(owner.page);
  const updateId = await captureActionId(owner.page, async () => {
    await owner.page.getByTestId("field-project-name").fill("Customer 360 (owner)");
    await owner.page.getByTestId("field-project-name").press("Enter");
  });
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 (owner)");

  const modeler = await newSession(browser, "Anna Nowak");
  await modeler.page.goto(projectHome());
  await hydrated(modeler.page);
  await expect(modeler.page.getByTestId("field-project-name")).toHaveValue("Customer 360 (owner)");

  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const { page } = await newSession(browser, who);
    await page.goto(projectHome());
    await hydrated(page);
    await expect(page.getByTestId("text-project-name")).toHaveText("Customer 360 (owner)");
    await expect(page.getByTestId("text-project-description")).toHaveText("One view of the customer across CRM and the web shop.");
    await expect(page.getByTestId("field-project-name")).toHaveCount(0);
    await expect(page.getByTestId("field-project-description")).toHaveCount(0);
  }

  const { page } = await newSession(browser, "Piotr Wiśniewski");
  const version = (await loadProject()).version;
  const reply = await callActionDirectly(page, updateId, [{ workspaceId: RETAIL, projectId: C360, expectedVersion: version, name: "Sneaky" }]);
  expect(reply).toContain("As a reviewer you cannot edit projects.");
  expect((await loadProject()).name).toBe("Customer 360 (owner)");
});

test("S9-08: an archived workspace shows text and refuses the write", async ({ browser }) => {
  const owner = await newSession(browser, "Łukasz");
  await owner.page.goto(projectHome());
  await hydrated(owner.page);
  const updateId = await captureActionId(owner.page, async () => {
    await owner.page.getByTestId("field-project-name").fill("Customer 360 (before)");
    await owner.page.getByTestId("field-project-name").press("Enter");
  });
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 (before)");

  await archive();
  await owner.page.goto(projectHome());
  await hydrated(owner.page);
  await expect(owner.page.getByTestId("text-project-name")).toHaveText("Customer 360 (before)");
  await expect(owner.page.getByTestId("field-project-name")).toHaveCount(0);
  const version = (await loadProject()).version;
  const reply = await callActionDirectly(owner.page, updateId, [{ workspaceId: RETAIL, projectId: C360, expectedVersion: version, name: "Archived" }]);
  expect(reply).toContain("This workspace is archived, so it is read-only.");
  expect((await loadProject()).name).toBe("Customer 360 (before)");
});
