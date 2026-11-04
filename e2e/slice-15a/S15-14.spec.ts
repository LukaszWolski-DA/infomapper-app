import { expect, test } from "./fixtures";
import { RETAIL } from "../slice-01a/helpers";
import { card, cubeEntities, cubeStore, entityIdOf, liveEntityNamed, openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

// S15-14 (X-4, without 15c's mappings): Dim Date's delete preview lists its SCD type and the facts that lose it, each
// once; the delete takes its InfoCube row in the same change group, and one undo brings both back. Since slice 15b the
// star has Dim Date's Ship date relationship too (role-playing RP-F): three relationships, two of them to Fact Sales, so
// "each once" is tested on the star itself; their three key links go with them and come back with the undo.

test("S15-14: Dim Date's preview lists SCD type 0 and 2 facts; the delete takes its role, one undo brings it back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await card(page, "Dim Date").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  const rows = dialog.getByTestId("table-entity-impact").locator("tbody tr");
  await expect(rows.filter({ hasText: "SCD type" })).toHaveText([/^Dimension\s*SCD type 0 deleted$/]);
  await expect(rows.filter({ hasText: "lose this dimension" })).toHaveText([/^2 facts\s*lose this dimension: Fact Orders, Fact Sales$|^2 facts\s*lose this dimension: Fact Sales, Fact Orders$/]);
  await expect(rows.filter({ hasText: /^\d+ relationships?/ })).toHaveText([/^3 relationships\s*deleted$/]);

  const dateRelationships = (await cubeStore().model.load(RETAIL)).relationships.filter((r) => r.from_entity_id === entityIdOf("date")).map((r) => r.id);
  const liveLinks = async () => (await cubeStore().modules.list(RETAIL, "cube_key")).filter((k) => dateRelationships.includes(k.relationship_id)).length;
  expect(await liveLinks()).toBe(3);

  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect(card(page, "Dim Date")).toHaveCount(0);
  await expect.poll(async () => (await cubeEntities()).some((c) => c.entity_id === entityIdOf("date"))).toBe(false);
  await expect.poll(liveLinks).toBe(0);

  await page.getByTestId("button-undo").click();
  await expect(card(page, "Dim Date")).toHaveCount(1);
  await expect.poll(async () => (await liveEntityNamed("Dim Date"))?.id).toBe(entityIdOf("date"));
  await expect.poll(async () => (await cubeEntities()).find((c) => c.entity_id === entityIdOf("date"))).toMatchObject({ role: "dimension", scd_type: 0 });
  await expect.poll(liveLinks).toBe(3);
});
