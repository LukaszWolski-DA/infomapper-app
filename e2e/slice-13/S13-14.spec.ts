import { expect, test } from "./fixtures";
import { canvasUrl, changeEntityAsAnna, entityNamed, expectToast, FULL, holdUntil, hydrated, notSaved, openCanvas, openEntityFromTree, recordToasts, signInAs, STALE, toasts } from "./helpers";

// S13-14 (item 5a, answer 7): a save refused as its panel closes. The alias's save is held while another entity is
// selected; its refusal leaves the draft for the page, the toast says so, and the draft comes back with "Not saved"
// when Customer's panel opens again. It is kept in the page's memory only: after a reload it is gone. Since slice 14b
// the reload asks first (the browser's warning, a kept draft for this page): the test accepts it.

test("S13-14: a draft refused after its panel closed comes back when the panel opens again, and is gone after a reload", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const alias = () => page.getByTestId("panel-entity").getByTestId("input-entity-alias");

  await changeEntityAsAnna("Customer", { stereotype: "context" });
  const hold = await holdUntil(page, '"alias":"Klient"');
  await alias().fill("Klient");
  // leaving the field saves it; the click on Product in the tree selects it (its panel may wait for the save's answer,
  // as the selection's transition goes with the save's)
  await page.getByTestId("tree-item").filter({ has: page.getByText("Product", { exact: true }) }).click();
  await expect.poll(() => hold.held()).toBe(true);
  hold.release();
  await hold.given;
  await expect(page.getByTestId("panel-entity").getByTestId("input-entity-name")).toHaveValue("Product");
  await expectToast(page, "Not saved: Alias of Customer. Open it again to see your text.");
  expect(await toasts(page)).toContain(STALE);

  await openEntityFromTree(page, "Customer");
  await expect(alias()).toHaveValue("Klient");
  await expect(notSaved(page.getByTestId("panel-entity"))).toHaveCount(1);
  expect((await entityNamed("Customer")).alias).toBeNull();

  const asked: string[] = [];
  page.once("dialog", (d) => {
    asked.push(d.type());
    void d.accept();
  });
  await page.reload();
  expect(asked).toEqual(["beforeunload"]);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  await expect(alias()).toHaveValue("");
  await expect(notSaved(page.getByTestId("panel-entity"))).toHaveCount(0);
});
