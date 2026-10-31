import { expect, test } from "./fixtures";
import {
  attributeBox,
  canvasRow,
  canvasUrl,
  CO,
  entityBox,
  expectBox,
  groupsOf,
  idsOf,
  openCanvas,
  recordToasts,
  SEED_IDS,
  setNamesAs,
  signInAs,
  toasts,
  cardOf,
} from "./helpers";

// Rights and the save chain (items 8, 9, F6): the check boxes and the segments are for editors; a reviewer sees the
// check boxes disabled and no segments, and a direct call is refused; two quick clicks store both changes with no
// false conflict.

test("S11-10: a reviewer sees the check boxes disabled and no segments, and a direct call is refused", async ({ page }) => {
  const customer = (await idsOf("Customer")).itemId;
  await signInAs(page, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl());
  await expect(entityBox(page)).toBeDisabled();
  await expect(attributeBox(page)).toBeDisabled();
  await expect(page.getByTestId("switch-names").locator("label").first()).toHaveAttribute("title", "Only editors change what this canvas shows");
  await expectBox(entityBox(page), "name");

  const head = cardOf(page, customer).locator(".c-head");
  const b = (await head.boundingBox())!;
  await page.mouse.click(b.x + 30, b.y + b.height / 2, { button: "right" });
  await expect(page.getByTestId("menu-toolbox")).toBeVisible();
  await expect(page.getByTestId("seg-entity-name")).toHaveCount(0);
  await expect(page.getByTestId("seg-attribute-names")).toHaveCount(0);

  await expect(setNamesAs("entity", "alias", CO, SEED_IDS.userPiotr)).rejects.toThrow("As a reviewer you cannot change what is on a canvas.");
  expect((await canvasRow()).entity_names).toBeNull();
});

test("S11-10: two quick clicks on a check box store both changes with no false conflict", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await entityBox(page).click();
  await entityBox(page).click();
  await expect.poll(async () => (await groupsOf(CO)).filter((g) => g.after && "entity_names" in g.after).map((g) => g.after!.entity_names)).toEqual(["alias", null]);
  expect((await canvasRow()).entity_names).toBeNull();
  await expectBox(entityBox(page), "name");
  // a look change right after them is not refused as stale: the look provider has the canvas's newest version
  await page.locator('[data-layer="mappings"]').click();
  await expect.poll(async () => (await canvasRow()).look.layer).toBe("mappings");
  expect((await toasts(page)).filter((t) => /changed|refus|again/i.test(t))).toEqual([]);
});
