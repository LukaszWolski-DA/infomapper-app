import { expect, test, type Page } from "./fixtures";
import { AROUND, canvasUrl, card, collapsedFrame, openCanvas, relationshipLine, selfRelationship, signInAs } from "./helpers";
import { relBundle } from "../slice-02c/helpers";

// Layers, frames and Focus for the loop (item 13): Mappings hides it, Relationships and Everything show it; a member of a
// collapsed concept frame has no loop and no bundle counts it; Focus on the entity lights it, Focus on another fades it.

const AT_100 = { x: -260, y: 140, zoom: 1 };
const layer = (page: Page, mode: "all" | "mappings" | "relationships") => page.getByTestId("switch-layer").locator(`[data-layer="${mode}"]`).click();
const lit = (page: Page, id: string) => page.getByTestId("layer-lit-lines").locator(`[data-relationship="${id}"]`);

async function focusOnCard(page: Page, name: string) {
  const head = (await card(page, name).locator(".c-head").boundingBox())!;
  await page.mouse.click(head.x + 30, head.y + head.height / 2, { button: "right" });
  await page.getByTestId("toolbox-focus").click();
}

test("S10A-09: Mappings hides the loop; Relationships and Everything show it", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  const loop = relationshipLine(page, rel.id);
  await expect(loop).toHaveCount(1);
  await layer(page, "mappings");
  await expect(loop).toHaveCount(0);
  await layer(page, "relationships");
  await expect(loop).toHaveCount(1);
  await layer(page, "all");
  await expect(loop).toHaveCount(1);
});

test("S10A-09: with Customer in a collapsed concept frame there is no loop and the frame's bundle counts only the line that leaves it", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await collapsedFrame(AROUND.customer, { concept: "Customer" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 140, zoom: 0.8 });
  await expect(card(page, "Customer")).toHaveCount(0);
  await expect(relationshipLine(page, rel.id)).toHaveCount(0);
  // the frame to Sales Order: "places" only
  await expect(relBundle(page, "1 relationship")).toHaveCount(1);
  await expect(relBundle(page, "2 relationships")).toHaveCount(0);
});

test("S10A-09: Focus on the entity lights the loop; Focus on another entity fades it", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  await focusOnCard(page, "Customer");
  await expect(lit(page, rel.id)).toHaveCount(1);
  await page.getByTestId("button-focus").click(); // off
  await expect(page.getByTestId("layer-lit-lines").locator("[data-relationship]")).toHaveCount(0);

  await openCanvas(page, canvasUrl(), { x: -40, y: -180, zoom: 0.8 }); // Sales Order in view
  await focusOnCard(page, "Sales Order");
  // Customer is lit through "places", its loop is not: it stays under the veil
  await expect(page.getByTestId("layer-lit-lines").locator("[data-relationship]").first()).toBeAttached();
  await expect(lit(page, rel.id)).toHaveCount(0);
});
