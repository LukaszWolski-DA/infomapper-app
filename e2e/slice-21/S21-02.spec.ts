// S21-02 (slice 21, item 2, D-72, D-76): the concept picker's last item "New concept “{text}”" while the typed text names
// no concept (case and extra spaces ignored); Enter keeps D-72 ("sal" picks Sales; several matches do nothing; the
// create item only when nothing matches); Enter and a click each make the concept and the entity (and a fact from the
// Cube tab) in one undo step, the concept in the first palette colour no concept uses; undo and redo take both; the
// toast; Escape creates nothing.

import { expect, starTest, test, type Page } from "./fixtures";
import {
  canvasUrl,
  conceptsRaw,
  createItem,
  cubeEntities,
  emptySpot,
  entitiesNamed,
  expectConceptPicker,
  expectToast,
  hydrated,
  liveConceptNamed,
  openCanvas,
  redoButton,
  signInAs,
  STAR_VIEW,
  starUrl,
  undoButton,
  WHOLE_CO,
} from "./helpers";

const toolboxItem = (page: Page, label: string) => page.getByTestId("menu-toolbox").getByTestId("toolbox-item").filter({ hasText: label });
const live = async () => (await conceptsRaw()).filter((c) => c.deleted_at === null).length;
const leaveName = async (page: Page) => {
  await page.getByTestId("input-entity-name").press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};

test("S21-02: the create item, Enter as D-72, one undo step for the concept and the entity, redo, the click, Escape", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const concepts0 = await live();

  // the Entity tool: no create item with an empty filter, or with an exact match in another case or with extra spaces
  await page.getByTestId("button-tool-entity").click();
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  let picker = await expectConceptPicker(page, "entity");
  await expect(picker.getByTestId("picker-filter")).toHaveAttribute("placeholder", "Type to filter or name a new concept…");
  await expect(createItem(picker)).toHaveCount(0);
  await page.keyboard.type("  reference   DATA ");
  await expect(picker.getByTestId("picker-item")).toHaveText(["Reference data"]);
  await expect(createItem(picker)).toHaveCount(0);

  // a partial match: the create item after the match; Enter picks the one matching concept (D-72, S17-01)
  await picker.getByTestId("picker-filter").fill("sal");
  await expect(picker.getByTestId("picker-item")).toHaveText(["Sales"]);
  await expect(createItem(picker)).toHaveText("+New concept “sal”");
  const order = await picker.locator("[data-pick-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["picker-item", "picker-create"]);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("input-entity-name")).toBeFocused();
  await expect.poll(async () => (await entitiesNamed("New entity")).length).toBe(1);
  expect(await live()).toBe(concepts0);
  await leaveName(page);
  await undoButton(page).click();
  await expect.poll(async () => (await entitiesNamed("New entity")).length).toBe(0);

  // several matches: Enter does nothing
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(spot.x, spot.y);
  picker = await expectConceptPicker(page, "entity");
  await page.keyboard.type("e");
  expect(await picker.getByTestId("picker-item").count()).toBeGreaterThan(1);
  await page.keyboard.press("Enter");
  await expect(picker).toHaveAttribute("data-shown", "true");

  // nothing matches: the create item alone; Enter makes the concept and the entity, in the first unused colour
  await picker.getByTestId("picker-filter").fill("  Fin   ance ");
  await expect(picker.getByTestId("picker-item")).toHaveCount(0);
  await expect(picker.getByTestId("picker-none")).toHaveCount(0);
  await expect(createItem(picker)).toHaveText("+New concept “Fin ance”");
  await page.keyboard.press("Enter");
  await expectToast(page, "Created New entity in the new concept Fin ance. Type its name now; change the concept in the panel.");
  await expect(page.getByTestId("input-entity-name")).toBeFocused();
  const finance = (await liveConceptNamed("Fin ance"))!;
  expect(finance).toMatchObject({ color: "#B7791F", sort_order: concepts0 });
  expect((await entitiesNamed("New entity"))[0]!.concept_id).toBe(finance.id);

  // one undo step takes both; redo brings both back
  await leaveName(page);
  await undoButton(page).click();
  await expectToast(page, "Undone: Create New entity in new concept Fin ance");
  await expect.poll(async () => (await entitiesNamed("New entity")).length).toBe(0);
  await expect.poll(() => liveConceptNamed("Fin ance")).toBeUndefined();
  await redoButton(page).click();
  await expect.poll(async () => (await entitiesNamed("New entity")).length).toBe(1);
  await expect.poll(async () => (await liveConceptNamed("Fin ance"))?.id).toBe(finance.id);

  // the toolbox's "New entity here" and a click on the create item
  const again = await emptySpot(page);
  await page.mouse.click(again.x, again.y, { button: "right" });
  await toolboxItem(page, "New entity here").click();
  picker = await expectConceptPicker(page, "entity");
  await page.keyboard.type("Loyalty");
  await createItem(picker).click();
  await expect.poll(async () => (await liveConceptNamed("Loyalty"))?.color).toBe("#D85A30");
  await expect(page.getByTestId("input-entity-name")).toBeFocused();
  await leaveName(page);

  // Escape with a name typed creates nothing
  const third = await emptySpot(page);
  await page.mouse.click(third.x, third.y, { button: "right" });
  await toolboxItem(page, "New entity here").click();
  picker = await expectConceptPicker(page, "entity");
  await page.keyboard.type("Nothing here");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  expect(await liveConceptNamed("Nothing here")).toBeUndefined();
});

starTest("S21-02: the Cube tab's New fact in a new concept, one undo step", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await hydrated(page);
  const facts = async () => (await cubeEntities()).filter((c) => c.role === "fact").length;
  const f0 = await facts();

  await page.getByTestId("tab-cube").click();
  await page.getByTestId("button-new-fact").click();
  const picker = await expectConceptPicker(page, "fact");
  await page.keyboard.type("Retail");
  await page.keyboard.press("Enter");
  await expectToast(page, "Created New fact in the new concept Retail. Type its name now; change the concept in the panel.");
  await expect.poll(facts).toBe(f0 + 1);
  const retail = (await liveConceptNamed("Retail"))!;
  expect((await entitiesNamed("New fact"))[0]!.concept_id).toBe(retail.id);
  await expect(picker).toHaveCount(0);

  await page.getByTestId("input-entity-name").press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await undoButton(page).click();
  await expect.poll(facts).toBe(f0);
  await expect.poll(() => liveConceptNamed("Retail")).toBeUndefined();
});
