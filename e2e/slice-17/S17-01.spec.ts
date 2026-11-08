// S17-01 (slice 17, item 1, D-72): outside a concept frame the Entity tool, the toolbox's "New entity here", its search's
// "Create entity …", and with InfoCube on "New fact here", "New dimension here" and the Cube tab's New fact and New
// dimension open the concept picker with nothing selected; typing filters; choosing creates in that concept, one undo
// step; Escape creates nothing. Inside a concept frame no picker shows: the frame's concept is taken.

import { test as starTest } from "../slice-15a/fixtures";
import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  cubeEntities,
  emptyIn,
  emptySpot,
  entitiesNamed,
  expectConceptPicker,
  item,
  loadModel,
  makeFrame,
  openCanvas,
  signInAs,
  STAR_VIEW,
  starUrl,
  undoButton,
  WHOLE_CO,
} from "./helpers";

const conceptOf = async (entityName: string) => {
  const m = await loadModel();
  const e = m.entities.find((x) => x.name === entityName && x.deleted_at === null);
  return e ? m.concepts.find((c) => c.id === e.concept_id)!.name : null;
};
const toolboxItem = (page: Page, label: string) => page.getByTestId("menu-toolbox").getByTestId("toolbox-item").filter({ hasText: label });

test("S17-01: outside a frame the Entity tool and the toolbox ask for the concept; typing filters; Escape creates nothing; one undo step", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const before = (await loadModel()).entities.length;

  // the Entity tool: the picker at the click, nothing selected; typing filters; Escape creates nothing
  await page.getByTestId("button-tool-entity").click();
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  const picker = await expectConceptPicker(page, "entity");
  const box = (await picker.boundingBox())!;
  expect(Math.abs(box.x - spot.x)).toBeLessThanOrEqual(8);
  await expect(picker.getByTestId("picker-item")).toHaveCount(4);
  await page.keyboard.type("ref");
  await expect(picker.getByTestId("picker-item")).toHaveText(["Reference data"]);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  expect((await loadModel()).entities.length).toBe(before);

  // "New entity here": the arrows reach an item; Enter on the one left picks it; created there, its name ready
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await toolboxItem(page, "New entity here").click();
  await expectConceptPicker(page, "entity");
  await page.keyboard.type("sal");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("input-entity-name")).toBeFocused();
  await expect.poll(() => conceptOf("New entity")).toBe("Sales");
  await expect(page.getByTestId("input-entity-name")).toHaveValue("New entity");

  // one undo step removes it
  await page.getByTestId("input-entity-name").press("Escape");
  await undoButton(page).click();
  await expect.poll(async () => (await entitiesNamed("New entity")).length).toBe(0);

  // the toolbox's search: "Create entity “Loyalty Card”" asks too, and a click on a concept creates it there
  const again = await emptySpot(page);
  await page.mouse.click(again.x, again.y, { button: "right" });
  await page.getByTestId("input-toolbox-search").fill("Loyalty Card");
  await page.getByTestId("toolbox-result").filter({ hasText: "Create entity" }).click();
  const fromSearch = await expectConceptPicker(page, "entity");
  await fromSearch.locator('[data-testid="picker-item"][data-label="Customer"]').click();
  await expect.poll(() => conceptOf("Loyalty Card")).toBe("Customer");
});

test("S17-01: inside a concept frame no picker shows; the frame's concept is taken", async ({ page }) => {
  // an empty Product frame to the right of the seed's cards
  const order = await item("Order Line");
  await makeFrame({ x: order.x + 600, y: order.y, width: 480, height: 320 }, { name: "Products here", concept: "Product" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  // the Entity tool's click inside it (a right click there opens the frame's own menu)
  const inside = await emptyIn(page, "Products here");
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(inside.x, inside.y);
  await expect(page.getByTestId("input-entity-name")).toBeFocused();
  await expect(page.getByTestId("picker-concept")).toHaveCount(0);
  await expect.poll(() => conceptOf("New entity")).toBe("Product");
});

starTest("S17-01: “New fact here”, “New dimension here” and the Cube tab's New fact and New dimension ask for the concept", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const facts = async () => (await cubeEntities()).filter((c) => c.role === "fact").length;
  const dimensions = async () => (await cubeEntities()).filter((c) => c.role === "dimension").length;
  const [f0, d0] = [await facts(), await dimensions()];

  // the toolbox
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await toolboxItem(page, "New fact here").click();
  const fact = await expectConceptPicker(page, "fact");
  await fact.locator('[data-testid="picker-item"][data-label="Sales"]').click();
  await expect.poll(facts).toBe(f0 + 1);
  await expect.poll(() => conceptOf("New fact")).toBe("Sales");
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await toolboxItem(page, "New dimension here").click();
  await expectConceptPicker(page, "dimension");
  await page.keyboard.press("Escape");
  expect(await dimensions()).toBe(d0);

  // the Cube tab: the picker under its button
  await page.getByTestId("tab-cube").click();
  const button = page.getByTestId("button-new-dimension");
  await button.click();
  const dim = await expectConceptPicker(page, "dimension");
  const b = (await button.boundingBox())!, p = (await dim.boundingBox())!;
  expect(p.y).toBeGreaterThanOrEqual(b.y + b.height);
  await dim.locator('[data-testid="picker-item"][data-label="Product"]').click();
  await expect.poll(dimensions).toBe(d0 + 1);
  await expect.poll(() => conceptOf("New dimension")).toBe("Product");
  await page.getByTestId("button-new-fact").click();
  await expectConceptPicker(page, "fact");
  await page.keyboard.press("Escape");
  expect(await facts()).toBe(f0 + 1);
});
