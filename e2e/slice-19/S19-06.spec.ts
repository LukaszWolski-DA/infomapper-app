// S19-06 (rights, AD-05): a reader and a reviewer see every value and no control; the domain refuses a base that is the
// fact itself or closes a cycle.

import { SEED_USERS } from "../../src/data/local/seed";
import { AGGREGATE_TEXTS } from "../../src/modules/infocube/domain/aggregates";
import { updateCubeEntity } from "../../src/modules/infocube/domain/commands";
import { expect, test } from "./fixtures";
import { baseSelect, cubeEntities, factlessFlag, factTypeSeg, historySeg, kindSeg, openEntity, openStar, periodField, refusalAs, segment, signInAs, typeEntity } from "./helpers";

for (const who of ["Kasia Zielińska", "Piotr Wiśniewski"] as const) {
  test(`S19-06: ${who} sees the types read only`, async ({ page }) => {
    await signInAs(page, who);
    await openStar(page);
    await openEntity(page, "Fact Orders");
    await expect(segment(factTypeSeg(page), "Transaction")).toHaveAttribute("aria-pressed", "true");
    for (const b of await factTypeSeg(page).getByRole("button").all()) await expect(b).toBeDisabled();
    await expect(factlessFlag(page)).toBeDisabled();
    await expect(baseSelect(page)).toBeDisabled();
    await expect(baseSelect(page)).toHaveValue(typeEntity("sales"));
    await openEntity(page, "Dim Product");
    await expect(segment(historySeg(page), "Snapshot")).toHaveAttribute("aria-pressed", "true");
    for (const b of await historySeg(page).getByRole("button").all()) await expect(b).toBeDisabled();
    for (const b of await kindSeg(page).getByRole("button").all()) await expect(b).toBeDisabled();
    await expect(periodField(page)).toHaveValue("Month-end");
    await expect(periodField(page)).toHaveAttribute("readonly", "");
  });
}

test("S19-06: the domain refuses a base that is the fact itself or closes a cycle", async () => {
  const rows = await cubeEntities();
  const sales = rows.find((c) => c.entity_id === typeEntity("sales"))!;
  const run = (base: string) =>
    refusalAs(SEED_USERS.lukasz.id, (ctx, access) =>
      updateCubeEntity(ctx, access, { cube: sales, cubeEntities: rows, entities: [{ id: typeEntity("orders"), name: "Fact Orders", deleted_at: null }, { id: typeEntity("sales"), name: "Fact Sales", deleted_at: null }] }, { cubeEntityId: sales.id, expectedVersion: sales.version, baseFactEntityId: base }),
    );
  expect(await run(typeEntity("sales"))).toBe(AGGREGATE_TEXTS.self);
  // Fact Orders is an aggregate of Fact Sales (demo): Fact Sales cannot be one of Fact Orders
  expect(await run(typeEntity("orders"))).toBe(AGGREGATE_TEXTS.cycle("Fact Orders", "Fact Sales"));
});
