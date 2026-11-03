import { expect, test } from "./fixtures";
import { canvasUrl, changeEntityAsAnna, conflictLine, entityNamed, expectToast, FULL, hydrated, openCanvas, openEntityFromTree, recordToasts, signInAs, STALE } from "./helpers";

// S13-08 (item 10, R4, answer 4): a choice field keeps no draft. Anna changes Customer's stereotype; this page's choice
// is refused as stale and the select shows the newest stored stereotype, with the toast; nothing is overwritten.

test("S13-08: a refused stereotype choice shows Anna's stereotype, with the toast; nothing overwritten", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const panel = page.getByTestId("panel-entity");
  const stereotype = panel.getByTestId("select-entity-stereotype");
  const before = (await entityNamed("Customer")).stereotype;
  await expect(stereotype).toHaveValue(before);

  await changeEntityAsAnna("Customer", { stereotype: "context" });
  await stereotype.selectOption(before === "link" ? "dictionary" : "link");
  await expectToast(page, STALE);
  await expect(stereotype).toHaveValue("context");
  await expect(conflictLine(panel)).toHaveCount(0);
  expect((await entityNamed("Customer")).stereotype).toBe("context");
});
