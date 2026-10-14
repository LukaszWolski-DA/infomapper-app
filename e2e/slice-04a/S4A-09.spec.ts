import { linkRequirement } from "../../src/domain/commands/requirement";
import { expect, test, type Page } from "./fixtures";
import { asPerson, canvasUrl, cardEl, ids, loadModel, loadRequirementLinks, mappingId, openCanvas, openRequirement, requirementByKey, SEED_IDS, signInAs } from "./helpers";

const traces = (page: Page) => page.getByTestId("item-req-trace").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText.split("\n")[0]} (${(e as HTMLElement).dataset.type})`));

test("S4A-09: Traces to: rows with their type, a mapping as `column → Entity.attribute`; an element whose card is on the open canvas is selected there; without its card, only its panel opens", async ({ page }) => {
  // REQ-104 also traced to Customer and to the mapping customers.email_addr → Customer.email, through the domain
  const { entity } = await ids();
  for (const target of [{ kind: "entity" as const, id: entity("Customer").id }, { kind: "mapping" as const, id: await mappingId("customers.email_addr", "Customer.email") }]) {
    const r104 = await requirementByKey("REQ-104");
    const [model, links] = await Promise.all([loadModel(), loadRequirementLinks()]);
    await asPerson(SEED_IDS.userAnna, (ctx, access) => linkRequirement(ctx, access, { requirement: r104, links, ...model }, { requirementId: r104.id, target }));
  }

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-104");
  await expect.poll(() => traces(page)).toEqual([
    "Sales Order.total_amount (attribute)",
    "Order Line.quantity (attribute)",
    "Order Line.unit_price (attribute)",
    "Order Line.discount_pct (attribute)",
    "Customer (entity)",
    "customers.email_addr → Customer.email (mapping)",
  ]);
  // Customer has a card here: it is selected and its panel opens
  await page.getByTestId("item-req-trace").filter({ hasText: /^Customer/ }).getByRole("button").first().click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(cardEl(page, "Customer")).toHaveClass(/\bsel\b/);
  // the mapping opens its panel
  await openRequirement(page, "REQ-104");
  await page.getByTestId("item-req-trace").filter({ hasText: "customers.email_addr" }).getByRole("button").first().click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();

  // on “Order lines & products” Customer has no card: only its attribute's panel opens, the view and cards stay
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));
  const view = await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  const cards = await page.locator("[data-card]").count();
  await openRequirement(page, "REQ-102");
  await page.getByTestId("item-req-trace").filter({ hasText: "Customer.first_name" }).getByRole("button").first().click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("panel-attribute")).toContainText("Customer");
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute("style", new RegExp(view.replace(/[().]/g, "\\$&")));
  await expect(page.locator("[data-card]")).toHaveCount(cards);
  await expect(page.locator("[data-card].sel")).toHaveCount(0);
});
