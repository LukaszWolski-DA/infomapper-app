import { expect, test } from "./fixtures";
import { card, cubeLines, hydrated, liveCubeMappings, openEntity, openStar, signInAs, undoButton } from "./helpers";

// S15-12 (IC-10, X-2, P21): Order Line's delete preview adds the dimensional mappings that read its attributes and the
// facts that lose their feed, each once: "6 dimensional mappings – deleted, 4 of them approved", "Fact Orders, Fact
// Sales – lose their feed from the logical model". The delete takes them in the same change group (net_amount's
// three-input mapping whole, Q-5); one undo brings everything back.

test("S15-12: Order Line's preview lists 6 dimensional mappings and the facts that lose their feed; the delete and its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const lines = await cubeLines(page).count();
  expect(await liveCubeMappings()).toHaveLength(20);

  await openEntity(page, "Order Line");
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  const rows = dialog.getByTestId("table-entity-impact").locator("tbody tr");
  await expect(rows.filter({ hasText: "dimensional mapping" })).toHaveText([/^6 dimensional mappings\s*deleted, 4 of them approved$/]);
  await expect(rows.filter({ hasText: "feed from the logical model" })).toHaveText([/^Fact Orders, Fact Sales\s*lose their feed from the logical model$/]);

  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect(card(page, "Order Line")).toHaveCount(0);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(14);
  await expect(cubeLines(page)).toHaveCount(lines - 6);

  await undoButton(page).click();
  await expect(card(page, "Order Line")).toHaveCount(1);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(20);
  await expect(cubeLines(page)).toHaveCount(lines);
});
