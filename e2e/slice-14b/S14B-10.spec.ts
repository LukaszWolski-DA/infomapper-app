import { expect, test } from "./fixtures";
import { canvasUrl, changeEntityAsAnna, conflictLine, entityNamed, FULL, hydrated, leaveAsksNothing, openCanvas, openEntityFromTree, signInAs } from "./helpers";

// S14B-10 (item 9, O6): a link inside the app with a draft gives no warning (Next.js's navigations stay in the page's
// document and fire no `beforeunload`) and breaks nothing: the project home shows, nothing of the draft is stored, and
// leaving the home asks nothing (the draft was kept for the canvas's page, D-66).

test("S14B-10: the Home tab with a conflict line on the canvas: no warning, the home shows, nothing stored", async ({ page }) => {
  const asked: string[] = [];
  page.on("dialog", (d) => {
    asked.push(d.type());
    void d.dismiss();
  });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const panel = page.getByTestId("panel-entity");
  await changeEntityAsAnna("Customer", { name: "Customer (Anna)" });
  const name = panel.getByTestId("input-entity-name");
  await name.fill("Client");
  await name.press("Tab");
  await expect(conflictLine(panel)).toBeVisible();

  await page.getByTestId("tab-home").click();
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  expect(asked).toEqual([]);
  expect((await entityNamed("Customer (Anna)"))?.name).toBe("Customer (Anna)");
  expect(await entityNamed("Client")).toBeUndefined();
  page.removeAllListeners("dialog");
  await leaveAsksNothing(page);
});
