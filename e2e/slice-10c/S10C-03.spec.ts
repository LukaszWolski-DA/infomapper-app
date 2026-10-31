import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, expectAttributeShown, groupsOf, openCanvas, pasteAs, rawAttribute, rowNamed, signInAs } from "./helpers";

// Following (item 6, F2, F5): the original's type and Personal data reach its copies and a copy of a copy in one change
// group; one undo restores all; in a copy's panel they are read-only, its own fields are not.

test("S10C-03: the original's type and Personal data reach every copy in one step; a copy's own fields stay its own", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const c1 = await pasteAs("Order Line", original);
  const c2 = await pasteAs("Sales Order", (await rawAttribute(c1))!);
  const typeOf = async (id: string) => {
    const a = (await rawAttribute(id))!;
    return `${a.data_type}(${a.type_length ?? ""})`;
  };
  const all = () => Promise.all([original.id, c1, c2].map(typeOf));

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  const panel = page.getByTestId("panel-attribute");

  // the type: one change group for the three
  await panel.getByTestId("select-attribute-type").selectOption("string");
  await expect.poll(all).toEqual(["string()", "string()", "string()"]);
  const last = async (id: string) => (await groupsOf(id)).at(-1)!.group;
  expect(new Set([await last(original.id), await last(c1), await last(c2)]).size).toBe(1);
  await panel.getByTestId("input-type-length").fill("40");
  await panel.getByTestId("input-type-length").press("Enter");
  await expect.poll(all).toEqual(["string(40)", "string(40)", "string(40)"]);
  // one undo restores the three
  await page.getByTestId("button-undo").click();
  await expect.poll(all).toEqual(["string()", "string()", "string()"]);

  // Personal data
  await panel.getByTestId("flags-attribute").getByRole("button", { name: "Personal data" }).click();
  await expect.poll(async () => Promise.all([original.id, c1, c2].map(async (id) => (await rawAttribute(id))!.is_pii))).toEqual([true, true, true]);

  // the copy's panel: type and Personal data read-only, its own fields free
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await expect(panel.getByTestId("hint-follows")).toHaveText("Follows Customer.customer_id.");
  await expect(panel.getByTestId("select-attribute-type")).toBeDisabled();
  await expect(panel.getByTestId("flags-attribute").getByRole("button", { name: "Personal data" })).toBeDisabled();
  await expect(panel.getByTestId("flags-attribute").getByRole("button", { name: "Can be empty" })).toBeEnabled();
  await panel.getByTestId("flags-attribute").getByRole("button", { name: "Can be empty" }).click();
  await panel.getByTestId("input-attribute-name").fill("client_id");
  await panel.getByTestId("input-attribute-name").press("Enter");
  await expect.poll(async () => (await rawAttribute(c1))!.name).toBe("client_id");
  expect(await rawAttribute(c1)).toMatchObject({ is_nullable: !original.is_nullable });
  expect(await rawAttribute(original.id)).toMatchObject({ name: "customer_id", is_nullable: original.is_nullable });
});
