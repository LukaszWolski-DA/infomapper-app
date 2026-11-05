// Slice 15b's helpers: the star's relationships and attributes by key, InfoCube's rows in the e2e data file, the
// panels' InfoCube sections (a fact's, a dimension's, an attribute's, a relationship's key), and a relationship's pill.

import type { Locator, Page } from "@playwright/test";
import { RETAIL } from "../slice-01a/helpers";
import { starId } from "../../src/modules/infocube/data/sales-star";
import { card, cubeStore, openCanvas, rowNamed, STAR_VIEW, starUrl } from "../slice-15a/helpers";
import { relationshipLine } from "../slice-10a/helpers";

export * from "../slice-15a/helpers";
export { relationshipLine } from "../slice-10a/helpers";

/** A relationship of the star: `date>sales` (Order date), `date>sales:ship` (Ship date), `cust>sales`, `date>orders` … */
export const relId = (key: string) => starId(RETAIL, `relationship:${key}`);
/** An attribute of the star: `sales.ship_date_key`, `date.date_key` … */
export const attrId = (key: string) => starId(RETAIL, `attribute:${key}`);

/** InfoCube's live rows and the model in the e2e data file. */
export async function liveKeys() {
  return (await cubeStore().modules.list(RETAIL, "cube_key")).filter((k) => k.deleted_at === null);
}
export async function liveMeasures() {
  return (await cubeStore().modules.list(RETAIL, "cube_measure")).filter((m) => m.deleted_at === null);
}
export async function cubeRowOf(entityId: string) {
  return (await cubeStore().modules.list(RETAIL, "cube_entity")).find((c) => c.deleted_at === null && c.entity_id === entityId);
}
export async function model() {
  return cubeStore().model.load(RETAIL);
}
/** The live link of a relationship: its attribute's id, or undefined. */
export async function keyOf(relationshipId: string) {
  return (await liveKeys()).find((k) => k.relationship_id === relationshipId)?.attribute_id;
}

/** Opens the star at 50 % (every card's rows drawn). */
export const openStar = (page: Page) => openCanvas(page, starUrl(), STAR_VIEW);

/** Opens an entity's panel by its card's name. */
export async function openEntity(page: Page, name: string): Promise<void> {
  await card(page, name).getByTestId("card-name").click();
  await page.getByTestId("panel-entity").waitFor();
}

/** Opens an attribute's panel by its row on a card. */
export async function openAttribute(page: Page, cardName: string, rowName: string): Promise<void> {
  await rowNamed(page, cardName, rowName).click();
  await page.getByTestId("panel-attribute").waitFor();
}

/** A fact's section and its lists. */
export const factSection = (page: Page) => page.getByTestId("section-cube-fact");
export const hints = (page: Page) => page.getByTestId("list-cube-hints").getByTestId("item-cube-hint");
export const hintsOk = (page: Page) => page.getByTestId("text-cube-hints-ok");
export const dimensionRows = (page: Page) => page.getByTestId("item-cube-dimension");
export const dimensionRow = (page: Page, relationshipId: string) => page.locator(`[data-testid="item-cube-dimension"][data-relationship="${relationshipId}"]`);
export const usedByRows = (page: Page) => page.getByTestId("item-cube-used-by");
export const measureRows = (page: Page) => page.getByTestId("item-cube-measure");

/** Opens a fact – dimension relationship's panel from the fact's Dimensions (the row selects the relationship). */
export async function openRelationshipFromFact(page: Page, fact: string, relationshipId: string): Promise<void> {
  await openEntity(page, fact);
  await dimensionRow(page, relationshipId).locator("button").first().click();
  await page.getByTestId("panel-relationship").waitFor();
}

/** The pill of a relationship's line: its text, and its rectangle's centre in canvas units (the path's coordinates). */
export const pillOf = (page: Page, relationshipId: string): Locator => relationshipLine(page, relationshipId).locator(".rlab");
export async function pillCentre(page: Page, relationshipId: string): Promise<{ x: number; y: number }> {
  const rect = pillOf(page, relationshipId).locator("rect");
  const [x, y, w, h] = await Promise.all(["x", "y", "width", "height"].map((a) => rect.getAttribute(a).then(Number)));
  return { x: x! + w! / 2, y: y! + h! / 2 };
}
/** The first point of a relationship's path, in canvas units. */
export async function pathStart(page: Page, relationshipId: string): Promise<{ x: number; y: number }> {
  const d = (await relationshipLine(page, relationshipId).locator("path.s").getAttribute("d")) ?? "";
  const [x, y] = d.replace(/^M/, "").split(/[ ,C]/).map(Number);
  return { x: x!, y: y! };
}

/** A third Dim Date → Fact Sales relationship without a role, as test data through the domain (RP-03, RP-04). */
export async function thirdDateRelationship(): Promise<string> {
  const { asLukasz } = await import("../slice-01b/helpers");
  const { createRelationship } = await import("../../src/domain/commands/relationship");
  const { entityIdOf } = await import("../slice-15a/helpers");
  const m = await model();
  const [date, sales] = [entityIdOf("date"), entityIdOf("sales")];
  const from = m.entities.find((e) => e.id === date)!, to = m.entities.find((e) => e.id === sales)!;
  const made = await asLukasz((ctx, access) => createRelationship(ctx, access, { from, to, oneEnd: date }, { fromEntityId: date, toEntityId: sales }));
  return made.relationship.id;
}
