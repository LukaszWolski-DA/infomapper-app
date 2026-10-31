import { expect, test } from "./fixtures";
import { attributeOf, pasteAs, rawAttribute, setAttributeAlias } from "./helpers";

// Copies (item 7, P10): a pasted copy of customer_id gets its alias once; a later change of the original's alias does
// not reach the copy.

test("S11-09: a copy of customer_id gets “Numer klienta”; a later change of the original's alias does not reach it", async () => {
  await setAttributeAlias("Customer", "customer_id", "Numer klienta");
  const copy = await pasteAs("Order Line", await attributeOf("Customer", "customer_id"));
  expect(await rawAttribute(copy)).toMatchObject({ name: "customer_id", alias: "Numer klienta" });

  await setAttributeAlias("Customer", "customer_id", "Id klienta");
  expect((await attributeOf("Customer", "customer_id")).alias).toBe("Id klienta");
  expect((await rawAttribute(copy))!.alias).toBe("Numer klienta");
});
