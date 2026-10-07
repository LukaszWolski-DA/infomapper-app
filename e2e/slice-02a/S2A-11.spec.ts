import { expect, test, type Page } from "./fixtures";
import { canvasIn, card, expectToast, key, openCanvas, SEED_IDS, signInAs, store, WHOLE } from "./helpers";

const ws = SEED_IDS.wsRetailDwh;
const layerOf = async (canvasId: string) => (await store().canvases.get(ws, canvasId))!.look.layer;
const layerButton = (page: Page, layer: string) => page.getByTestId("switch-layer").locator(`[data-layer="${layer}"]`);
const counts = async (page: Page) => ({
  maps: await page.getByTestId("layer-lines").locator('[data-testid="line-mapping"]').count(),
  rels: await page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').count(),
});

test("S2A-11: Mappings hides the relationship lines and Relationships hides the mapping lines; the mode is saved per canvas, another canvas keeps its own, and Ctrl+Z does not change it", async ({ page }) => {
  const om = SEED_IDS.projOrderManagement, here = SEED_IDS.canvasCustomerOrders, other = SEED_IDS.canvasOrderLines;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasIn(om, here), WHOLE);
  const all = await counts(page);
  expect(all.maps).toBeGreaterThan(0);
  expect(all.rels).toBeGreaterThan(0);
  await expect(layerButton(page, "all")).toHaveAttribute("aria-pressed", "true");
  expect(await layerButton(page, "all").innerText()).toBe("All"); // short labels below 2100 px

  // a layout change first, so Ctrl+Z has something to undo
  await card(page, "Customer").getByTestId("card-name").click();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("button-undo")).toBeEnabled();

  await layerButton(page, "mappings").click();
  await expect.poll(() => counts(page)).toEqual({ maps: all.maps, rels: 0 });
  await expect(page.locator(".react-flow__node")).toHaveCount(7); // the cards stay
  await layerButton(page, "relationships").click();
  await expect.poll(() => counts(page)).toEqual({ maps: 0, rels: all.rels });
  await expect.poll(() => layerOf(here)).toBe("relationships");

  // Ctrl+Z undoes the card's move, not the mode
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move card");
  expect(await counts(page)).toEqual({ maps: 0, rels: all.rels });
  expect(await layerOf(here)).toBe("relationships");

  // another canvas keeps its own mode; each canvas opens in its saved one
  await page.getByTestId("tab-canvas").filter({ hasText: "Order lines & products" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${other}$`));
  await expect(layerButton(page, "all")).toHaveAttribute("aria-pressed", "true");
  expect(await layerOf(other)).toBe("all");
  await layerButton(page, "mappings").click();
  await expect.poll(() => layerOf(other)).toBe("mappings");
  await openCanvas(page, canvasIn(om, here));
  await expect(layerButton(page, "relationships")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => counts(page)).toEqual({ maps: 0, rels: all.rels });
});
