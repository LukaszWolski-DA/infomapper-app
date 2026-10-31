import { expect, test } from "./fixtures";
import { attributeBox, canvasRow, canvasUrl, exceptionsOf, expectBox, HALF, idsOf, openCanvas, setException, signInAs, tintOf, undo } from "./helpers";

// Undo of the canvas's control after card exceptions (P8): three cards with attribute exceptions; checking “Attribute
// aliases” clears all three; one undo restores them and their tints; redo clears them again.

const CARDS = ["Customer", "Sales Order", "Order Line"];

test("S11-11: “Attribute aliases” clears three exceptions; one undo restores them with their tints; redo clears them again", async ({ page }) => {
  for (const name of CARDS) await setException(name, { attributeNames: "alias" });
  const items = await Promise.all(CARDS.map(async (n) => (await idsOf(n)).itemId));
  const exceptions = () => Promise.all(CARDS.map(async (n) => (await exceptionsOf(n)).attribute));
  const tints = () => Promise.all(items.map(async (i) => (await tintOf(page, i)).rows));
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), HALF);
  await expectBox(attributeBox(page), "mixed");
  expect(await tints()).toEqual([true, true, true]);

  await attributeBox(page).click();
  await expect.poll(exceptions).toEqual([null, null, null]);
  await expect.poll(tints).toEqual([false, false, false]);
  await expectBox(attributeBox(page), "alias");
  expect((await canvasRow()).attribute_names).toBe("alias");

  await undo(page);
  await expect.poll(exceptions).toEqual(["alias", "alias", "alias"]);
  await expect.poll(async () => (await canvasRow()).attribute_names).toBeNull();
  await expect.poll(tints).toEqual([true, true, true]);
  await expectBox(attributeBox(page), "mixed");

  await page.getByTestId("button-redo").click();
  await expect.poll(exceptions).toEqual([null, null, null]);
  await expect.poll(async () => (await canvasRow()).attribute_names).toBe("alias");
  await expect.poll(tints).toEqual([false, false, false]);
  await expectBox(attributeBox(page), "alias");
});
