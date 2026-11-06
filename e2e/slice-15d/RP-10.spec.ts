import { expect, test } from "./fixtures";
import { busDots, entityIdOf, expectSelected, hydrated, openAttribute, openBusMatrix, openStar, relId, signInAs } from "./helpers";

// RP-10 (R-8): the bus matrix shows one dot per relationship. Fact Sales × Dim Date is ●● (Order date, Ship date), each
// dot's title names its role and key and opens its relationship; with ship_date_key's foreign key flag cleared its link
// is inactive (R3) and its dot is hollow, "…, but no key carries it".

test("RP-10: Fact Sales × Dim Date shows ●●; the titles name the roles and keys; each dot opens its relationship", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  let dialog = await openBusMatrix(page);
  const dots = () => busDots(dialog, entityIdOf("sales"), entityIdOf("date"));
  await expect.poll(dots).toEqual([
    { title: "Fact Sales uses Dim Date as Order date: date_key", key: "date_key", text: "●" },
    { title: "Fact Sales uses Dim Date as Ship date: ship_date_key", key: "ship_date_key", text: "●" },
  ]);
  await dialog.locator(`[data-testid="bus-dot"][data-relationship-id="${relId("date>sales:ship")}"]`).click();
  await expectSelected(page, "relationship");
  await expect(page.getByTestId("panel-inspector")).toContainText("Ship date");

  // the flag cleared: the link is inactive, its dot hollow
  await openAttribute(page, "Fact Sales", "ship_date_key");
  await page.getByTestId("flags-attribute").getByRole("button", { name: "Foreign key" }).click();
  await expect(page.getByTestId("item-cube-carries")).toHaveCount(0);
  dialog = await openBusMatrix(page);
  await expect.poll(dots).toEqual([
    { title: "Fact Sales uses Dim Date as Order date: date_key", key: "date_key", text: "●" },
    { title: "Fact Sales uses Dim Date as Ship date, but no key carries it", key: "", text: "○" },
  ]);
});
