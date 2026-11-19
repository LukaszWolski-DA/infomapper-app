// S30-09 (slice 30, Q6, Q7, L5): the top bar's server badge says `Local` on the local adapter, and the save indicator
// follows the page's writes: "Saving…" while one is on its way (its answer held, `holdUntil`), "Saved", which fades, and
// "Not saved" after a refusal, with the refusal's reason and what to do in its tooltip.
import { expect, test } from "./fixtures";
import { badge, canvasUrl, changeEntityAsAnna, entityNamed, expectSaveState, FULL, holdUntil, hydrated, indicator, openCanvas, openEntityFromTree, RETAIL, signInAs } from "./helpers";

test("S30-09: the badge says Local, on the workspace home, a project home and a canvas", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}`);
  await expect(badge(page)).toHaveText("Local", { useInnerText: true });
  await expect(badge(page)).toHaveAttribute("title", "Local server: changes are saved in a file on this computer (development and the demo).");
  await openCanvas(page, canvasUrl(), FULL);
  await expect(badge(page)).toHaveText("Local", { useInnerText: true });
  // one pair, before the details panel's button
  await expect(indicator(page)).toHaveCount(1);
  const pair = await page.getByTestId("group-save").boundingBox();
  const toggle = await page.getByTestId("button-toggle-right").boundingBox();
  expect(pair!.x + pair!.width).toBeLessThanOrEqual(toggle!.x);
  await expectSaveState(page, "idle");
});

test("S30-09: Saving… while a save is on its way, then Saved, which fades", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");
  const hold = await holdUntil(page, '"name":"Customer A"');
  await name.fill("Customer A");
  await name.press("Enter");
  await expect.poll(async () => (await entityNamed("Customer A"))?.id).toBeTruthy();
  await expectSaveState(page, "saving");
  await expect(indicator(page)).toHaveText("Saving…");
  hold.release();
  await hold.given;
  await expectSaveState(page, "saved");
  await expect(indicator(page)).toHaveText("Saved");
  await expectSaveState(page, "fading", 5_000);
  await expectSaveState(page, "idle", 5_000);
});

test("S30-09: Not saved after a refused save, with its reason and what to do", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  // another session renames Customer: this page's save comes with an older version and is refused as stale
  await changeEntityAsAnna("Customer", { alias: "Client" });
  const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");
  await name.fill("Customer B");
  await name.press("Enter");
  await expectSaveState(page, "failed");
  await expect(indicator(page)).toHaveText("Not saved");
  await expect(indicator(page)).toHaveAttribute("title", "Your last change was not saved: Someone changed this meanwhile. A text you typed is kept in its field.");
  // the field keeps its draft as "Not saved" (D-66); leaving it again saves it on the newest version, which clears the mark
  await name.focus();
  await name.press("Enter");
  await expectSaveState(page, "saved");
});
