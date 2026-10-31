import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, expectAttributeShown, holdAnswer, menuOn, openCanvas, pasteAs, rawAttribute, recordToasts, rowNamed, setLengthAs, signInAs, STALE, toasts } from "./helpers";

// The save chain (F4): a followed field saved on the original holds its copies, so a copy's delete started at once
// waits for it and sends the copy's new version: both stored, no false conflict. The test holds the save's answer back
// (`holdAnswer`), so the delete is started before it arrives.

test("S10C-09: the original's length, then at once a copy deleted from its row's menu: both stored, no conflict", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const copy = await pasteAs("Order Line", original);
  await setLengthAs(original.id, 10);
  await signInAs(page, "Łukasz");
  await recordToasts(page);
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  // the length's answer is held back 2 s (the server has written it): the copy's delete is started meanwhile
  const held = await holdAnswer(page, '"length":20');
  const length = page.getByTestId("panel-attribute").getByTestId("input-type-length");
  await length.fill("20");
  await length.press("Enter"); // the save starts; nothing waits for it
  await menuOn(page, rowNamed(page, "Order Line", "customer_id"), "Delete attribute");

  await expect.poll(async () => (await rawAttribute(original.id))!.type_length).toBe(20);
  expect(held()).toBe(true);
  await expect.poll(async () => (await rawAttribute(copy))!.deleted_at).not.toBeNull();
  // the copy followed before it went
  expect((await rawAttribute(copy))!.type_length).toBe(20);
  expect(await toasts(page)).not.toContain(STALE);
});
