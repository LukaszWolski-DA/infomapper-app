// S19-03 (items 3, 7): Fact Orders (demo) is an aggregate of Fact Sales, Fact Sales lists it; Fact Sales' select does
// not offer Fact Orders; a relationship between Fact Orders and Dim Order Flags (stored from the dimension, D-67) gives
// the base hint; deleting Fact Sales names Fact Orders in the preview and clears its base; one undo restores both.

import { createRelationship } from "../../src/domain/commands/relationship";
import { SEED_USERS } from "../../src/data/local/seed";
import { TYPE_HINTS } from "../../src/modules/infocube/domain/keys";
import { expect, test } from "./fixtures";
import { asCube, baseSelect, card, cubeRow, hints, openEntity, openStar, roleOf, signInAs, typeEntity, undoButton } from "./helpers";

test("S19-03: Aggregate of and Aggregated by; no cycle offered; the base hint; the base's delete and its undo", async ({ page }) => {
  // Dim Order Flags → Fact Orders, as test data through the domain (the dimension is the 1..1 end, D-67)
  await asCube(SEED_USERS.lukasz.id, (ctx, access, s) =>
    s.model.load(access.workspace.id).then((m) => {
      const [flags, orders] = [typeEntity("flags"), typeEntity("orders")];
      return createRelationship(ctx, access, { from: m.entities.find((e) => e.id === flags)!, to: m.entities.find((e) => e.id === orders)!, oneEnd: flags }, { fromEntityId: flags, toEntityId: orders });
    }),
  );
  await signInAs(page, "Łukasz");
  await openStar(page);

  await openEntity(page, "Fact Orders");
  await expect(roleOf(page, "Fact Orders")).toHaveText("Fact · Aggregate");
  await expect(roleOf(page, "Fact Orders")).toHaveAttribute("title", "Transaction fact, aggregate of Fact Sales (InfoCube)");
  await expect(baseSelect(page)).toHaveValue(typeEntity("sales"));
  await expect(page.getByTestId("text-cube-base")).toHaveText("It summarises Fact Sales at a coarser grain: its dimensions should be Fact Sales's or fewer.");
  await expect(hints(page).filter({ hasText: "its base" })).toHaveText([TYPE_HINTS.base("Dim Order Flags", "Fact Sales")]);

  await page.getByTestId("link-cube-base").click();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");
  await expect(page.getByTestId("item-cube-aggregated-by")).toHaveText([/^Fact Orders\s*One sales order$/]);
  await expect(baseSelect(page).locator("option")).toHaveText(["Not an aggregate"]);

  // the base's delete: the preview names Fact Orders, then Fact Orders has no base; one undo brings both back
  await card(page, "Fact Sales").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  const rows = dialog.getByTestId("table-entity-impact").locator("tbody tr");
  await expect(rows.filter({ hasText: "base fact" })).toHaveText([/^Fact Orders\s*loses its base fact$/]);
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expect(card(page, "Fact Sales")).toHaveCount(0);
  await expect.poll(async () => (await cubeRow(typeEntity("orders")))?.base_fact_entity_id).toBeNull();
  await expect(roleOf(page, "Fact Orders")).toHaveText("Fact");

  await undoButton(page).click();
  await expect(card(page, "Fact Sales")).toHaveCount(1);
  await expect.poll(async () => (await cubeRow(typeEntity("orders")))?.base_fact_entity_id).toBe(typeEntity("sales"));
  await expect(roleOf(page, "Fact Orders")).toHaveText("Fact · Aggregate");
});
