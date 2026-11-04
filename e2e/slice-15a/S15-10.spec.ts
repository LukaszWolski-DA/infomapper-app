import { createRelationship } from "../../src/domain/commands/relationship";
import { CROSS_LEVEL_RELATIONSHIP_MESSAGE } from "../../src/domain/model/levels";
import { expect, test } from "./fixtures";
import { card, cubeStore, entityIdOf, liveEntityNamed, openCanvas, recordToasts, refusalAs, SEED_IDS, signInAs, STAR_VIEW, starUrl, toasts } from "./helpers";

// S15-10 (IC-09, B-7, D-67): a relationship between the levels is refused with the prototype's toast, also by direct
// call; a new relationship from a fact to a dimension is turned so the dimension is the 1..1 end.

test("S15-10: Customer to Fact Sales refused, also directly; Fact Sales to Dim Product turned to Dim Product 1..1 – Fact Sales 0..N", async ({ page }) => {
  expect(CROSS_LEVEL_RELATIONSHIP_MESSAGE).toBe("Facts and dimensions relate to each other. To trace a fact to the logical model, map its attributes.");
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const before = (await cubeStore().model.load(SEED_IDS.wsRetailDwh)).relationships.length;

  await card(page, "Customer").getByTestId("button-card-relate").click();
  await card(page, "Fact Sales").getByTestId("card-name").click();
  await expect.poll(() => toasts(page)).toContain(CROSS_LEVEL_RELATIONSHIP_MESSAGE);
  expect((await cubeStore().model.load(SEED_IDS.wsRetailDwh)).relationships.length).toBe(before);

  const customer = (await liveEntityNamed("Customer"))!;
  const model = await cubeStore().model.load(SEED_IDS.wsRetailDwh);
  const fact = model.entities.find((e) => e.id === entityIdOf("sales"))!;
  expect(await refusalAs(SEED_IDS.userLukasz, (ctx, access) => createRelationship(ctx, access, { from: customer, to: fact }, { fromEntityId: customer.id, toEntityId: fact.id }))).toBe(CROSS_LEVEL_RELATIONSHIP_MESSAGE);

  await card(page, "Fact Sales").getByTestId("button-card-relate").click();
  await card(page, "Dim Product").getByTestId("card-name").click();
  await expect.poll(() => toasts(page)).toContain("Relationship added. Name it and set the cardinality on the right.");
  await expect.poll(async () => (await cubeStore().model.load(SEED_IDS.wsRetailDwh)).relationships.length).toBe(before + 1);
  const added = (await cubeStore().model.load(SEED_IDS.wsRetailDwh)).relationships.filter((r) => r.label === null || r.label === "");
  expect(added.map((r) => [r.from_entity_id, r.from_min, r.from_max, r.to_entity_id, r.to_min, r.to_max])).toEqual([[entityIdOf("prod"), 1, "1", entityIdOf("sales"), 0, "n"]]);
});
