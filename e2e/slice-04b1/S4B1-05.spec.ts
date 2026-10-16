// S4B1-05 (slice 4b-1, PRD items 16–18): selecting a requirement colours its scope on the canvas, with no fading. REQ-105
// (Łukasz's answer A): its covered rows blue (first_name, last_name, email) and its gap orange (birth_date); REQ-101 (an
// entity item) tints Customer's header. Approving birth_date's mapping turns its row blue; with REQ-105 still selected,
// an undo turns it orange again and a redo blue (the colours follow the data while the requirement stays selected).
// Escape and a click on empty canvas clear the colours. No card's own class or style changes (checked on the DOM).
// With a frame around Customer and Sales Order collapsed, the block's Customer row carries the summary dot (Łukasz's
// answer to step 6): orange for REQ-105 (birth_date a gap), blue for REQ-101; Sales Order's row none (not in scope).
// With a frame around all seven cards collapsed, a requirement on the one card past the sixth puts its dot on the “and
// 1 more” row and on no member's row (Łukasz's answer after step 6's follow-up).

import { AROUND, collapsedFrame, item, loadItems } from "../slice-02c/helpers";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, emptySpot, ids, mappingId, openCanvas, openRequirement, requirementLinkedTo, RETAIL, signInAs, store, WHOLE } from "./helpers";

const rows = (page: Page, colour: "covered" | "gap") => page.getByTestId(`coverage-row-${colour}`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row));
/** Every card's own class and style, to check that colouring changes none of them. */
const cardsLook = (page: Page) =>
  page.locator(".react-flow__node").evaluateAll((els) =>
    els.map((n) => {
      const c = n.querySelector("[data-card]") as HTMLElement | null;
      return `${(n as HTMLElement).dataset.id}|${n.className}|${(n as HTMLElement).style.cssText}|${c?.className ?? ""}|${c?.getAttribute("style") ?? ""}`;
    }),
  );

test("S4B1-05: selecting REQ-105 colours its covered rows blue and its gap orange with nothing faded; REQ-101 tints Customer's header; the colours follow an approval and its undo while selected; Escape and an empty click clear them; no card's own look changes", async ({ page }) => {
  const { attribute } = await ids();
  const covered = ["first_name", "last_name", "email"].map((a) => attribute("Customer", a).id);
  const birth = attribute("Customer", "birth_date").id;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(800);
  const before = await cardsLook(page);

  await openRequirement(page, "REQ-105");
  await expect.poll(() => rows(page, "covered")).toEqual(covered);
  await expect.poll(() => rows(page, "gap")).toEqual([birth]);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  expect(await cardsLook(page), "no card's own class or style changes").toEqual(before);

  // REQ-101: an entity item, Customer's header tinted (Customer is covered: some of its attributes are)
  await openRequirement(page, "REQ-101");
  const customerId = await card(page, "Customer").getAttribute("data-id");
  await expect(page.locator(`[data-testid="coverage-header-covered"][data-card="${customerId}"]`)).toHaveCount(1);
  await expect(page.getByTestId("coverage-row-covered")).toHaveCount(0);

  // approving birth_date's mapping (in review) from its panel, then REQ-105 again: the row is blue
  await page.locator(`[data-row="${birth}"]`).first().click();
  await page.getByTestId("list-attribute-mappings").getByText("customers.dob").click();
  await page.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved", exact: true }).click();
  const dob = await mappingId("customers.dob", "Customer.birth_date");
  await expect.poll(async () => (await store().model.load(RETAIL)).mappings.find((m) => m.id === dob)?.status).toBe("approved");
  await openRequirement(page, "REQ-105");
  await expect.poll(() => rows(page, "covered")).toEqual([...covered, birth]);
  // with REQ-105 still selected: an undo makes it a gap again, a redo covered
  await page.getByTestId("button-undo").click();
  await expect.poll(() => rows(page, "gap")).toEqual([birth]);
  await page.getByTestId("button-redo").click();
  await expect.poll(() => rows(page, "gap")).toEqual([]);
  await expect.poll(() => rows(page, "covered")).toContain(birth);

  // Escape clears the selection and the colours; so does a click on empty canvas
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layer-coverage-rows")).toHaveCount(0);
  await openRequirement(page, "REQ-105");
  await expect(page.getByTestId("layer-coverage-rows")).toHaveCount(1);
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.getByTestId("layer-coverage-rows")).toHaveCount(0);
  expect(await cardsLook(page)).toEqual(before);
});

test("S4B1-05 (collapsed frames): a collapsed frame's block carries the summary dot on its members' rows in scope", async ({ page }) => {
  const frameId = await collapsedFrame(AROUND.customerAndSales, { name: "Customer and orders" });
  const [customer, sales] = await Promise.all([item("Customer"), item("Sales Order")]);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const dot = (colour: "covered" | "gap", member: string) => page.locator(`[data-testid="coverage-block-dot-${colour}"][data-block="${frameId}"][data-member="${member}"]`);

  await openRequirement(page, "REQ-105");
  await expect(dot("gap", customer.id)).toHaveCount(1);
  await expect(page.locator(`[data-member="${sales.id}"][data-testid^="coverage-block-dot-"]`)).toHaveCount(0);
  await openRequirement(page, "REQ-101");
  await expect(dot("covered", customer.id)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid^="coverage-block-dot-"]')).toHaveCount(0);
});

test("S4B1-05 (and N more): the members past the sixth share one dot on the block's “and N more” row", async ({ page }) => {
  const frameId = await collapsedFrame({ x: -4000, y: -4000, width: 12000, height: 12000 }, { name: "Everything" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  // the seventh card: the one the block does not list
  const shown = await page.getByTestId("block-member").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.member));
  expect(shown).toHaveLength(6);
  await expect(page.getByTestId("block-more")).toHaveText("and 1 more");
  const seventh = (await loadItems()).find((i) => !shown.includes(i.id))!;
  const key = await requirementLinkedTo(seventh.entity_id ? { kind: "entity", id: seventh.entity_id } : { kind: "source_table", id: seventh.source_table_id! });

  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await openRequirement(page, key);
  const dots = page.locator(`[data-testid^="coverage-block-dot-"][data-block="${frameId}"]`);
  await expect(dots).toHaveCount(1);
  await expect(dots).toHaveAttribute("data-member", "more");
});
