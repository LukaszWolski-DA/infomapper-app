import { expect, test } from "./fixtures";
import { card, cubeEntities, entityIdOf, liveEntityNamed, openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

// S15-14 (X-4, without 15c's mappings): Dim Date's delete preview lists its SCD type and the facts that lose it, each
// once; the delete takes its InfoCube row in the same change group, and one undo brings both back.

test("S15-14: Dim Date's preview lists SCD type 0 and 2 facts; the delete takes its role, one undo brings it back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await card(page, "Dim Date").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  const rows = dialog.getByTestId("table-entity-impact").locator("tbody tr");
  await expect(rows.filter({ hasText: "SCD type" })).toHaveText([/^Dimension\s*SCD type 0 deleted$/]);
  await expect(rows.filter({ hasText: "lose this dimension" })).toHaveText([/^2 facts\s*lose this dimension: Fact Orders, Fact Sales$|^2 facts\s*lose this dimension: Fact Sales, Fact Orders$/]);
  await expect(rows.filter({ hasText: /^\d+ relationships?/ })).toHaveText([/^2 relationships\s*deleted$/]);

  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect(card(page, "Dim Date")).toHaveCount(0);
  await expect.poll(async () => (await cubeEntities()).some((c) => c.entity_id === entityIdOf("date"))).toBe(false);

  await page.getByTestId("button-undo").click();
  await expect(card(page, "Dim Date")).toHaveCount(1);
  await expect.poll(async () => (await liveEntityNamed("Dim Date"))?.id).toBe(entityIdOf("date"));
  await expect.poll(async () => (await cubeEntities()).find((c) => c.entity_id === entityIdOf("date"))).toMatchObject({ role: "dimension", scd_type: 0 });
});
