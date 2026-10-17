// S4B1-06 (slice 4b-1, PRD items 20–22; step 7): Focus. On “Customer & orders”:
//   - on from the toolbar (with nothing selected it says what it does), off from the status bar's chip; on and off from
//     a card's and a row's menu;
//   - the lit set (the veil's holes) for an entity, an attribute, a mapping, a relationship, a frame, a multi-selection
//     and a requirement, as the domain's `targetLit` works it out (Customer's also written out); a change of selection
//     moves it; a requirement keeps its coverage colours;
//   - switching Focus commits neither the canvas nor the miniature;
//   - off after switching canvas (a tab in “Order management”) and after a reload (not saved).
// “Show everything” (the view reset) does not exist in the application yet (the view-state bar, D-39): not tested.

import { targetLit, type LitTarget } from "../../src/domain/model/lit";
import { AROUND, expectToast, makeFrame, namePoint, pointOnLine, rowNamed } from "../slice-02c/helpers";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, commitCounters, holeAt, ids, loadModel, nodeRect, openCanvas, openRequirement, SEED_IDS, signInAs, veilHoles, WHOLE } from "./helpers";

const CARDS = ["Customer", "Sales Order", "Order Line", "customers", "web_users", "order_header", "order_line"];

/** The cards on the page that lie in a hole of the veil (lit), by name; [] with no veil. */
async function litCards(page: Page): Promise<string[]> {
  if (!(await page.getByTestId("layer-fade").count())) return [];
  const holes = await veilHoles(page);
  const out: string[] = [];
  for (const name of CARDS) if ((await card(page, name).count()) && holeAt(holes, await nodeRect(card(page, name)))) out.push(name);
  return out.sort();
}

/** The cards the domain lights for a target, by name. */
async function expected(target: LitTarget): Promise<string[]> {
  const model = await loadModel();
  const lit = targetLit(model, target);
  const names = [...model.entities.filter((e) => lit.entities.has(e.id)).map((e) => e.name), ...model.sourceTables.filter((t) => lit.tables.has(t.id)).map((t) => t.name)];
  return names.filter((n) => CARDS.includes(n)).sort();
}

const header = (page: Page, name: string) => card(page, name).locator(".c-head .c-l2");
const focusButton = (page: Page) => page.getByTestId("button-focus");

test("S4B1-06: Focus on from the toolbar and the menus, off from the chip; the lit set for each kind of selection; off after switching canvas and after a reload", async ({ page }) => {
  const { entity, attribute, model } = await ids();
  const customer = entity("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);

  // the toolbar, with nothing selected: Focus on, its hint, its chip; nothing fades yet
  await focusButton(page).click();
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "true");
  await expectToast(page, "Focus fades everything not connected to what you select.");
  await expect(page.getByTestId("chip-focus")).toBeVisible();
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);

  // an entity: Customer, its feeding tables and Sales Order (the relationship)
  await header(page, "Customer").click();
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", `focus:${customer.id}`);
  await expect.poll(() => litCards(page)).toEqual(["Customer", "Sales Order", "customers", "web_users"]);
  expect(await litCards(page)).toEqual(await expected({ t: "entity", id: customer.id }));
  // switching Focus never re-renders the canvas or the miniature (S4B1-13's guard; development counters)
  await page.waitForTimeout(500);
  const counted = await commitCounters(page);
  await focusButton(page).click();
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  await focusButton(page).click();
  await expect(page.getByTestId("layer-fade")).toHaveCount(1);
  await page.waitForTimeout(300);
  expect((await commitCounters(page)).canvas, "canvas commits").toBe(counted.canvas);
  expect((await commitCounters(page)).miniature, "miniature commits").toBe(counted.miniature);

  // a change of selection moves it: an attribute
  const email = attribute("Customer", "email");
  await rowNamed(page, "Customer", "email").click();
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", `focus:attribute:${email.id}`);
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "attribute", id: email.id }));

  // a mapping (its line), a relationship (its line)
  const dob = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const mapLine = page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${dob.id}"]`);
  let at = await pointOnLine(mapLine, 0.5);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", `focus:mapping:${dob.id}`);
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "mapping", id: dob.id }));
  const places = model.relationships.find((r) => r.from_entity_id === customer.id && r.to_entity_id === entity("Sales Order").id)!;
  at = await pointOnLine(page.getByTestId("layer-lines").locator(`[data-testid="line-relationship"][data-relationship="${places.id}"]`), 0.3);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", `focus:relationship:${places.id}`);
  await expect.poll(() => litCards(page)).toEqual(["Customer", "Sales Order"]);

  // several cards: Customer and order_line (Shift+click)
  const orderLine = model.sourceTables.find((t) => t.name === "order_line")!;
  await header(page, "Customer").click();
  await header(page, "order_line").click({ modifiers: ["Shift"] });
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "several", entities: [customer.id], tables: [orderLine.id] }));

  // a requirement: its scope lit, its coverage colours on
  await openRequirement(page, "REQ-105");
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^focus:requirement:/);
  await expect.poll(() => litCards(page)).toEqual(["Customer", "customers", "web_users"]);
  await expect(page.getByTestId("coverage-row-covered")).toHaveCount(3);
  await expect(page.getByTestId("coverage-row-gap")).toHaveCount(1);

  // the chip's × turns it off; the veil goes, the colours stay with the selection
  await page.getByTestId("chip-focus-off").click();
  await expect(page.getByTestId("chip-focus")).toHaveCount(0);
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  await expect(page.getByTestId("coverage-row-covered")).toHaveCount(3);

  // a card's menu: “Focus on this” (the right-click selects the card), then “Turn Focus off”
  await header(page, "Sales Order").click({ button: "right" });
  await expect(page.getByTestId("toolbox-focus")).toHaveText("Focus on this");
  await page.getByTestId("toolbox-focus").click();
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "entity", id: entity("Sales Order").id }));
  await header(page, "Sales Order").click({ button: "right" });
  await expect(page.getByTestId("toolbox-focus")).toHaveText("Turn Focus off");
  await page.getByTestId("toolbox-focus").click();
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);

  // a row's menu (a column)
  const customers = model.sourceTables.find((t) => t.name === "customers")!;
  const custId = model.sourceColumns.find((c) => c.name === "cust_id" && c.source_table_id === customers.id)!;
  await rowNamed(page, "customers", "cust_id").click({ button: "right" });
  await page.getByTestId("toolbox-focus").click();
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", `focus:column:${custId.id}`);
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "column", id: custId.id }));

  // not saved: off after a reload
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chip-focus")).toHaveCount(0);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
});

test("S4B1-06 (frames, canvases): Focus on a frame lights its cards' connections; switching canvas turns Focus off", async ({ page }) => {
  await makeFrame(AROUND.sales, { name: "Sales" });
  const { entity } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(SEED_IDS.canvasCustomerOrders, SEED_IDS.projOrderManagement), WHOLE);

  // a frame: what its cards light (Sales Order and Order Line)
  const name = await namePoint(page, "Sales");
  await page.mouse.click(name.x, name.y);
  await focusButton(page).click();
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^focus:several:/);
  await expect.poll(() => litCards(page)).toEqual(await expected({ t: "several", entities: [entity("Order Line").id, entity("Sales Order").id], tables: [] }));

  // another canvas of the project: Focus is off there, and still off back on this one
  await page.getByTestId("tab-canvas").filter({ hasText: "Order lines & products" }).click();
  await expect(page).toHaveURL(new RegExp(SEED_IDS.canvasOrderLines));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chip-focus")).toHaveCount(0);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  await page.getByTestId("tab-canvas").filter({ hasText: "Customer & orders" }).click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(focusButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
});
