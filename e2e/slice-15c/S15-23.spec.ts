import { expect, test } from "./fixtures";
import { card, clickCubeLine, cubeMappingId, openStar, rowNamed, setCard, signInAs, STAR, undo } from "./helpers";

// S15-23 (C12, P17, X4), the canvas's part: a fact's or dimension's coverage bar counts its attributes fed from the
// logical model (any status), "{n} of {m} attributes fed from the logical model"; a row's dot says where it comes from,
// or "Not fed from the logical model"; Mapped and Not mapped read the same feeds. After a mapping's delete and its undo.
// The Overview's "{n} of {m} fed" comes with the panels (step 5).

test("S15-23: Dim Customer's fed bar, its rows' dots and the Mapped filter; a delete and its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  const dim = card(page, "Dim Customer");
  await expect(dim.locator(".cov")).toHaveAttribute("title", "4 of 5 attributes fed from the logical model");
  await expect(dim.locator(".cov-t")).toHaveText("4/5");
  await expect(rowNamed(page, "Dim Customer", "segment_code").getByTestId("dot-mapped")).toHaveAttribute("title", "from Customer.segment_code");
  await expect(rowNamed(page, "Dim Customer", "customer_key").getByTestId("dot-mapped")).toHaveAttribute("title", "Not fed from the logical model");
  // a logical card keeps "mapped" (source mappings)
  await expect(card(page, "Customer").locator(".cov")).toHaveAttribute("title", /attributes mapped$/);

  // the delete of segment_code's mapping: 3 of 5, back to 4 of 5 with Undo
  await clickCubeLine(page, cubeMappingId("cust.segment_code"));
  await page.keyboard.press("Delete");
  await expect(dim.locator(".cov")).toHaveAttribute("title", "3 of 5 attributes fed from the logical model");
  await expect(rowNamed(page, "Dim Customer", "segment_code").getByTestId("dot-mapped")).toHaveAttribute("title", "Not fed from the logical model");
  await undo(page);
  await expect(dim.locator(".cov")).toHaveAttribute("title", "4 of 5 attributes fed from the logical model");

  // Mapped and Not mapped on a dimensional card read its feeds (X4)
  await setCard("Dim Customer", { rowFilter: "mapped" }, STAR);
  await page.reload();
  await expect(dim.locator(".row[data-row] .nm")).toHaveText(["customer_number", "segment_code", "city", "country_name"]);
  await setCard("Dim Customer", { rowFilter: "unmapped" }, STAR);
  await page.reload();
  await expect(dim.locator(".row[data-row] .nm")).toHaveText(["customer_key"]);
});

// Step 5 (P17, F19): the Overview's "Mapping coverage" counts a fact's or a dimension's feeds as "{n} of {m} fed",
// titled "Attributes fed from the logical model"; a logical entity keeps "{n} of {m}". After a delete and its undo.
test("S15-23: the Overview's {n} of {m} fed; a delete and its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  const coverage = page.getByTestId("list-coverage").getByTestId("item-coverage");
  const row = (name: string) => coverage.filter({ hasText: name }).first();
  await expect(row("Dim Customer")).toContainText("4 of 5 fed");
  await expect(row("Dim Customer")).toHaveAttribute("title", "Attributes fed from the logical model");
  await expect(row("Dim Date")).toContainText("0 of 5 fed");
  await expect(row("Order Line")).not.toContainText("fed");

  await clickCubeLine(page, cubeMappingId("cust.segment_code"));
  await page.keyboard.press("Delete");
  await expect(row("Dim Customer")).toContainText("3 of 5 fed");
  await undo(page);
  await expect(row("Dim Customer")).toContainText("4 of 5 fed");
});
