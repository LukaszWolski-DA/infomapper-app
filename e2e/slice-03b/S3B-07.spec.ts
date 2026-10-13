import { expect, test } from "./fixtures";
import { canvasUrl, contextOn, expectCard, ids, liveCards, liveUrl, openCanvas, openLiveFor, rowNamed, signInAs, typeLabel } from "./helpers";

test("S3B-07: labeling made on another canvas (and by the active context) changes the live canvas too; opening it afterwards shows the change without a toast", async ({ page }) => {
  test.setTimeout(150_000);
  const { entity, table } = await ids();
  const live = await openLiveFor("CR-23");
  const has = async (id: string) => (await liveCards(live)).some(([e]) => e === id);
  expect(await has(table("order_line").id)).toBe(false);
  expect(await has(entity("Sales Order").id)).toBe(false);
  await signInAs(page, "Łukasz");

  // on Customer & orders: CR-23 put on order_line.qty in its panel; the live canvas gets order_line as context
  await openCanvas(page, canvasUrl(), { x: -560, y: 40, zoom: 0.6 });
  await rowNamed(page, "order_line", "qty").click();
  await typeLabel(page, "CR-23");
  await page.keyboard.press("Enter");
  await expect.poll(() => liveCards(live)).toContainEqual([table("order_line").id, "context", "labeled"]);

  // with the context on CR-23: renaming an attribute of Sales Order labels it; the live canvas gets Sales Order as context
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl(), { x: 0, y: -300, zoom: 0.8 });
  await rowNamed(page, "Sales Order", "order_date").click();
  const name = page.getByTestId("input-attribute-name");
  await name.fill("ordered_on");
  await name.press("Enter");
  await expect.poll(() => liveCards(live)).toContainEqual([entity("Sales Order").id, "context", "labeled"]);

  // the live canvas opened afterwards shows both, without the “Added from” toast (that is for the open live canvas only)
  await openCanvas(page, liveUrl(live));
  await expectCard(page, "order_line");
  await expectCard(page, "Sales Order");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("toast-message")).not.toContainText("Added from");
});
