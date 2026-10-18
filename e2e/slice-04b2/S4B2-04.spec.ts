// S4B2-04 (slice 4b-2, PRD items 14–15): placing requirement cards from element panels. A row's “Place card” places the
// card 80 px right of the element (an attribute: from 20 px above its row) and selects it; on a card already here it
// selects that card and brings it into view; a row dragged onto the canvas places the card at the drop; “Add the {n}
// missing to this canvas” places the rest beside the element, stacked, and then goes; the view fits when a placed card
// falls outside it; a click on the name opens the requirement's panel.

import { expect, test, type Page } from "./fixtures";
import {
  box,
  canvasUrl,
  card,
  emptySpot,
  expectToast,
  loadModel,
  openCanvas,
  openEntityFromTree,
  reqCard,
  reqCardData,
  row,
  signInAs,
  zoomOf,
} from "./helpers";

const VIEW = { x: 10, y: 10, zoom: 0.42 };
/** The Requirements section's row of a requirement in the open element panel. */
const sectionRow = (page: Page, key: string) => page.locator(`[data-testid="item-requirement"][data-key="${key}"]`).first();

test("S4B2-04: “Place card” beside the element, or showing a card already here; dragging a row places the card at the drop; “Add the n missing”; the view fits; a click on the name opens the requirement", async ({ page }) => {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const birth = model.attributes.find((a) => a.entity_id === customer.id && a.name === "birth_date")!;
  await signInAs(page, "Łukasz");

  // the view fits when the placed card falls outside it: Customer at the left edge at 300 %
  await openCanvas(page, canvasUrl(), { x: 10 - 496 * 3, y: 10 - 40 * 3, zoom: 3 });
  await row(page, "Customer", birth.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await sectionRow(page, "REQ-105").getByTestId("button-requirement-place").click();
  await expectToast(page, "Placed 1 requirement card on this canvas.");
  await expect.poll(() => zoomOf(page)).toBeLessThan(3);
  const pane = await box(page.locator(".react-flow__pane"));
  await expect.poll(async () => {
    const c = await box(reqCard(page, "REQ-105"));
    return c.x >= pane.x && c.x + c.width <= pane.x + pane.width;
  }).toBe(true);
  // beside Customer (496 + 256 + 80), from 20 px above birth_date's row, on the grid; and selected
  const placed = (await reqCardData("REQ-105"))!;
  expect(placed.x).toBe(832);
  const rowIndex = model.attributes.filter((a) => a.entity_id === customer.id).sort((a, b) => a.sort_order - b.sort_order).findIndex((a) => a.id === birth.id);
  expect(placed.y).toBe(Math.round((40 + 54 + 6 + rowIndex * 26 + 13 - 20) / 8) * 8);
  await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-105");

  // “Place card” on a card already here: selects it and brings it into view
  await openCanvas(page, canvasUrl(), VIEW);
  await row(page, "Customer", birth.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(sectionRow(page, "REQ-105")).toHaveAttribute("data-on-canvas", "true");
  await sectionRow(page, "REQ-105").getByTestId("button-requirement-place").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-105");
  await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
  expect((await reqCardData("REQ-105"))!.version).toBe(placed.version);

  // a click on a row's name opens the requirement's panel
  await openEntityFromTree(page, "Customer");
  await sectionRow(page, "REQ-103").locator("button").first().click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-103");

  // dragging a row onto the canvas places the card where it is dropped (never a link)
  await openCanvas(page, canvasUrl(), VIEW);
  await openEntityFromTree(page, "Customer");
  const spot = await emptySpot(page);
  const paneBox = await box(page.locator(".react-flow__pane"));
  // native drag and drop, as the left panel's items are dragged (S3B-10)
  await sectionRow(page, "REQ-101").dragTo(page.locator(".react-flow__pane"), { targetPosition: { x: spot.x - paneBox.x, y: spot.y - paneBox.y } });
  await expectToast(page, "Placed REQ-101 on this canvas.");
  const dropped = (await reqCardData("REQ-101"))!;
  // the drop point on the board (opening Customer's panel from the Model tab moved the view to its card)
  const at = await page.evaluate(([x, y]) => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec((document.querySelector(".react-flow__viewport") as HTMLElement).style.transform)!;
    return { x: (x - Number(m[1])) / Number(m[3]), y: (y - Number(m[2])) / Number(m[3]) };
  }, [spot.x - paneBox.x, spot.y - paneBox.y] as const);
  expect(Math.abs(dropped.x + 115 - at.x)).toBeLessThanOrEqual(8);
  expect(Math.abs(dropped.y + 30 - at.y)).toBeLessThanOrEqual(8);

  // “Add the 2 missing” (REQ-102 and REQ-103; REQ-101 and REQ-105 are here): beside Customer, stacked; then it goes
  await openEntityFromTree(page, "Customer");
  await expect(page.getByTestId("button-requirements-add-all")).toHaveText("Add the 2 missing to this canvas");
  await page.getByTestId("button-requirements-add-all").click();
  await expectToast(page, "Placed 2 requirement cards on this canvas.");
  await expect.poll(async () => [!!(await reqCardData("REQ-102")), !!(await reqCardData("REQ-103"))]).toEqual([true, true]);
  const [a, b] = [(await reqCardData("REQ-102"))!, (await reqCardData("REQ-103"))!];
  expect(a.x).toBe(832);
  expect(b.x).toBe(832);
  expect(b.y).toBeGreaterThan(a.y);
  await expect(page.getByTestId("button-requirements-add-all")).toHaveCount(0);
  await expect(card(page, "Customer")).toBeVisible();
});
