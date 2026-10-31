import { expect, test } from "./fixtures";
import { canvasUrl, openCanvas, hydrated, setAttributeAlias, setEntityAlias, signInAs } from "./helpers";

// Search (item 14, F13): the object browser finds an entity by its alias and by an attribute's alias, naming the alias
// in the hint line; a match by name is unchanged.

test("S11-08: “Klient” finds Customer with “alias Klient”, “Numer” with the attribute's alias; “Customer” is unchanged", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  await setAttributeAlias("Customer", "customer_id", "Numer klienta");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
  const search = page.getByTestId("input-tree-search");
  const items = page.getByTestId("tree-item");

  await search.fill("Klient");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Customer");
  await expect(items.first()).toContainText("alias Klient");

  await search.fill("Numer");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("attribute customer_id · Numer klienta");

  await search.fill("Customer");
  const customer = items.filter({ has: page.getByText("Customer", { exact: true }) });
  await expect(customer).toHaveCount(1);
  await expect(customer).not.toContainText("alias");
});
