// S5A-04 (slice 5a, PRD item 5, Q4): a hidden details panel stays hidden when a card, a row or a line is selected (and
// when an entity is clicked in the left panel); it opens on its button and on each action that leads to details on
// purpose, and stays open afterwards (remembered).

import { expect, test, type Page } from "./fixtures";
import {
  AROUND,
  FRAMED,
  bundleWithCount,
  canvasUrl,
  card,
  collapsedFrame,
  dragBetween,
  emptySpot,
  expectHidden,
  expectShown,
  ids,
  key,
  loadLabels,
  loadNotes,
  makeFrame,
  namePoint,
  openCanvas,
  openRequirementsTab,
  panel,
  panelsCookie,
  pointOnLine,
  requirementByKey,
  requirementRow,
  rowNamed,
  screenPoint,
  signInAs,
  toggle,
  togglePanel,
  toolboxAt,
  treeItem,
} from "./helpers";

async function hideRight(page: Page) {
  if ((await toggle(page, "right").getAttribute("aria-pressed")) === "true") await togglePanel(page, "right");
  await expectHidden(page, "right");
}

/** Picks an item of the open toolbox. */
const pick = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name }).click();

/** The panel opened by an action: shown, and remembered. */
async function expectOpened(page: Page) {
  await expectShown(page, "right");
  await expect.poll(() => panelsCookie(page)).toMatch(/^l1\.r1\./); // written in the browser, after hydration
}

test("S5A-04: selecting a card, a row, a line or an entity in the left panel leaves a hidden details panel hidden; its button opens it for good", async ({ page }) => {
  const { model, attribute } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await hideRight(page);

  await card(page, "Customer").locator(".c-head").click({ position: { x: 20, y: 10 } });
  await rowNamed(page, "Customer", "email").click();
  const mapping = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const p = await pointOnLine(page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mapping.id}"]`));
  await page.mouse.click(p.x, p.y);
  await treeItem(page, "Sales Order").click();
  await expectHidden(page, "right");
  // the selection is there all the same: the panel shows it as soon as it opens
  await togglePanel(page, "right");
  await expectShown(page, "right");
  await expect(panel(page, "right").getByTestId("panel-entity")).toBeVisible();
  await page.reload();
  await expectShown(page, "right");
});

test("S5A-04: arriving through a link that names what to show opens the details panel (?card, ?label, ?req, ?note)", async ({ page }) => {
  const { entity } = await ids();
  const label = (await loadLabels())[0]!;
  const note = (await loadNotes())[0]!;
  const req = await requirementByKey("REQ-101");
  await signInAs(page, "Łukasz");
  for (const [query, testId] of [
    [`card=entity:${entity("Customer").id}`, "panel-entity"],
    [`label=${label.id}`, "panel-label"],
    [`req=${req.id}`, "panel-requirement"],
    [`note=${note.id}`, "panel-note"],
  ] as const) {
    await openCanvas(page);
    await hideRight(page);
    await page.goto(`${canvasUrl()}?${query}`);
    await expectOpened(page);
    await expect(panel(page, "right").getByTestId(testId), query).toBeVisible();
  }
});

test("S5A-04: the menu items that edit a field in the details panel open it, with the field focused", async ({ page }) => {
  const { model, attribute } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });

  // a mapping line: “Edit transformation rule…”
  await hideRight(page);
  const mapping = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  await toolboxAt(page, await pointOnLine(page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mapping.id}"]`)));
  await expectHidden(page, "right"); // the right-click selects the line first (D-19); that alone opens nothing
  await pick(page, "Edit transformation rule…");
  await expectOpened(page);
  await expect(page.locator("#f-rule")).toBeFocused();

  // a relationship line: “Edit name and cardinality…”
  await hideRight(page);
  await toolboxAt(page, await pointOnLine(page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').first(), 0.3));
  await pick(page, "Edit name and cardinality…");
  await expectOpened(page);
  await expect(page.locator("#f-rl")).toBeFocused();

  // an attribute row: “Map from a column…”; a column row: “Map to an attribute…”
  for (const [cardName, rowName, item, field] of [
    ["Customer", "email", "Map from a column…", "#f-addc"],
    ["customers", "segment", "Map to an attribute…", "#f-adda"],
  ] as const) {
    await hideRight(page);
    const r = (await rowNamed(page, cardName, rowName).boundingBox())!;
    await toolboxAt(page, { x: r.x + 30, y: r.y + r.height / 2 });
    await pick(page, item);
    await expectOpened(page);
    await expect(page.locator(field), item).toBeFocused();
  }
});

test("S5A-04: a frame's “Rename…” opens the details panel", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "People" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hideRight(page);
  await toolboxAt(page, await namePoint(page, "People"));
  await pick(page, "Rename…");
  await expectOpened(page);
  await expect(page.locator("#f-fn")).toBeFocused();
});

test("S5A-04: a bundle's “Show what is inside” opens the details panel", async ({ page }) => {
  // slice 2c's S2C-07 setup: a bundle of 13 lines between two collapsed frames
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customerAndSales, { name: "People" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hideRight(page);
  await toolboxAt(page, await pointOnLine(bundleWithCount(page, 13), 0.3));
  await pick(page, "Show what is inside");
  await expectOpened(page);
  await expect(panel(page, "right").getByTestId("panel-bundle")).toBeVisible();
});

test("S5A-04: creating something whose name is typed in the details panel opens it; so does a requirement's click in the left panel", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: -900, zoom: 1 });
  const nameField = page.getByTestId("input-entity-name");

  // the Entity tool
  await hideRight(page);
  const area = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(area.x + 300, area.y + 200);
  await expectOpened(page);
  await expect(nameField).toBeFocused();
  await page.keyboard.press("Enter");

  // “New entity here”
  await hideRight(page);
  await toolboxAt(page, await emptySpot(page));
  await pick(page, "New entity here");
  await expectOpened(page);
  await expect(nameField).toBeFocused();
  await page.keyboard.press("Enter");

  // “+” of a concept in the left panel
  await hideRight(page);
  await page.getByTestId("button-concept-add").first().click();
  await expectOpened(page);
  await expect(nameField).toBeFocused();
  await page.keyboard.press("Enter");

  // a frame drawn with the Frame tool
  await hideRight(page);
  await key(page, "a");
  await dragBetween(page, await screenPoint(page, { x: 100, y: 1000 }), await screenPoint(page, { x: 400, y: 1200 }));
  await expectOpened(page);
  await expect(page.locator("#f-fn")).toBeFocused();
  await page.keyboard.press("Escape");

  // the Requirements tab: a requirement's click, and “New requirement”
  await hideRight(page);
  await openRequirementsTab(page);
  await requirementRow(page, "REQ-101").click();
  await expectOpened(page);
  await expect(panel(page, "right").getByTestId("panel-requirement")).toBeVisible();
  await hideRight(page);
  await page.getByTestId("button-new-requirement").click();
  await expectOpened(page);
  await expect(page.locator("#f-rqn")).toBeFocused();
});
