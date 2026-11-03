import { deleteEntityAs } from "../slice-12b/helpers";
import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, FULL, hydrated, loadModel, openCanvas, openEntityFromTree, recordToasts, signInAs, toasts } from "./helpers";

// S13-11 (item 9, answer 8): a save on an entity deleted meanwhile in another session. The domain's toast; the
// refusal's fresh page no longer has the entity, so its panel goes, and the draft goes with it: no "Not saved: …" toast,
// and nothing is kept for the page.

test("S13-11: a save on an entity deleted meanwhile: the domain's toast, the panel goes, the draft with it", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const panel = page.getByTestId("panel-entity");

  await deleteEntityAs("Customer");
  await panel.getByTestId("input-entity-alias").fill("Klient");
  await panel.getByTestId("input-entity-alias").press("Enter");
  await expectToast(page, "This entity does not exist.");
  await expect(panel).toHaveCount(0);
  await page.waitForTimeout(800); // room for a "Not saved: …" toast that must not come
  expect(await toasts(page)).toEqual(["This entity does not exist."]);
  expect((await loadModel()).entities.some((e) => e.name === "Customer")).toBe(false);
});
