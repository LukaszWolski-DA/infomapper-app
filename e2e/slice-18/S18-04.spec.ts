// S18-04 (slice 18, item 2, D-73; Łukasz, step 4: every count agrees with the row's square): Fact Sales' net_amount
// (demo) counts as fed on the card, in its row's square and in the Overview; with one input's feed deleted it does not,
// its square is hollow and the panel names the gap; REQ-210, linked to it, covers it only when its inputs are covered.
// The logical level the same way with mappings: the card, the Mapped and Not mapped filters and the status bar.

import { expect, test } from "./fixtures";
import {
  addAttributeAs,
  approvedMapping,
  calcSection,
  calculateAs,
  canvasUrl,
  cardCount,
  cubeMappingId,
  deleteCubeMappingElsewhere,
  deleteMappingAs,
  gapsOf,
  hydrated,
  ids,
  liveModel,
  openAttribute,
  openCanvas,
  openRequirement,
  openStar,
  overviewLine,
  rowNamed,
  setCard,
  signInAs,
  WHOLE_CO,
} from "./helpers";

const NET_GAP = "Fact Sales.net_amount an input of its calculation is not covered";

test("S18-04: net_amount is fed through its calculation on the card and in the Overview; an input's feed deleted makes it a gap", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  // Fact Sales: 9 attributes; ship_date_key is not fed; net_amount is fed through quantity, unit_price and discount_pct
  await expect(cardCount(page, "Fact Sales")).toHaveText("8/9");
  const dot = rowNamed(page, "Fact Sales", "net_amount").getByTestId("dot-mapped");
  await expect(dot).toHaveClass(/\bcalc ok\b/);
  await expect(dot).toHaveAttribute("title", "Calculated from quantity, unit_price, discount_pct: every input is fed");
  await expect(overviewLine(page, "Fact Sales")).toContainText("8 of 9 fed");

  await deleteCubeMappingElsewhere(cubeMappingId("sales.discount_pct"));
  await page.reload();
  await hydrated(page);
  await expect(cardCount(page, "Fact Sales")).toHaveText("6/9");
  await expect(dot).toHaveClass(/\bcalc\b/);
  await expect(dot).not.toHaveClass(/\bok\b/);
  await expect(dot).toHaveAttribute("title", "Calculated from quantity, unit_price, discount_pct: not every input is fed yet");
  await expect(overviewLine(page, "Fact Sales")).toContainText("6 of 9 fed");
  await openAttribute(page, "Fact Sales", "net_amount");
  await expect(calcSection(page).getByTestId("note-calc-state")).toHaveText("Not yet: discount_pct is not fed.");
});

test("S18-04: REQ-210 covers net_amount only when its calculation's inputs are covered", async ({ page }) => {
  const { attribute, column } = await ids();
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText("0 of 3 covered");
  await expect.poll(() => gapsOf(page)).toContain(NET_GAP);

  // the fact's three inputs are fed from Order Line; approved source mappings behind those cover them
  for (const [a, c] of [["quantity", "qty"], ["unit_price", "price"], ["discount_pct", "disc"]] as const) await approvedMapping(attribute("Order Line", a).id, column("order_line", c).id);
  await page.reload();
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText("1 of 3 covered");
  await expect.poll(() => gapsOf(page)).not.toContain(NET_GAP);

  await deleteCubeMappingElsewhere(cubeMappingId("sales.unit_price"));
  await page.reload();
  await hydrated(page);
  await openRequirement(page, "REQ-210");
  await expect(page.getByTestId("text-req-coverage")).toHaveText("0 of 3 covered");
  await expect.poll(() => gapsOf(page)).toContain(NET_GAP);
});

test("S18-04: the logical level: a calculation from mapped attributes counts on the card, in the filters and the status bar", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { ...WHOLE_CO, zoom: 0.6 });
  await hydrated(page);
  const [mapped, total] = (await cardCount(page, "Customer").innerText()).split("/").map(Number) as [number, number];
  const [sm, st] = (await page.getByTestId("status-mapped").innerText()).match(/(\d+) of (\d+)/)!.slice(1).map(Number) as [number, number];

  // a new attribute, calculated from first_name and last_name (both mapped): one more attribute, one more mapped
  await addAttributeAs("Customer", "full_name");
  await calculateAs("Customer", "full_name", ["first_name", "last_name"], "first_name || last_name");
  await page.reload();
  await hydrated(page);
  await expect(cardCount(page, "Customer")).toHaveText(`${mapped + 1}/${total + 1}`);
  await expect(page.getByTestId("status-mapped")).toContainText(`${sm + 1} of ${st + 1}`);
  await expect(rowNamed(page, "Customer", "full_name").getByTestId("dot-mapped")).toHaveClass(/\bcalc ok\b/);

  // the Mapped filter shows it, Not mapped does not
  await setCard("Customer", { rowFilter: "mapped" });
  await page.reload();
  await expect(rowNamed(page, "Customer", "full_name")).toHaveCount(1);
  await setCard("Customer", { rowFilter: "unmapped" });
  await page.reload();
  await expect(rowNamed(page, "Customer", "full_name")).toHaveCount(0);
  await setCard("Customer", { rowFilter: "all" });

  // last_name's mapping deleted: last_name and full_name no longer count; full_name's square hollow
  const lastName = (await liveModel()).attributes.find((a) => a.entity_id === customer.id && a.name === "last_name")!;
  const lastMapping = (await liveModel()).mappings.find((x) => x.attribute_id === lastName.id && x.deleted_at === null)!;
  await deleteMappingAs(lastMapping.id);
  await page.reload();
  await hydrated(page);
  await expect(cardCount(page, "Customer")).toHaveText(`${mapped - 1}/${total + 1}`);
  await expect(page.getByTestId("status-mapped")).toContainText(`${sm - 1} of ${st + 1}`);
  await expect(rowNamed(page, "Customer", "full_name").getByTestId("dot-mapped")).not.toHaveClass(/\bok\b/);
});
