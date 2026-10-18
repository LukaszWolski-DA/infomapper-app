// S4B1-03 (slice 4b-1, PRD items 11 and 13): the coverage text “{m} of {n} covered” with a tooltip naming the parts; an
// entity item that is a gap is listed (“Order Line: no approved mapping on any attribute”) and a click goes to the entity.
// The project home, the status bar, the workspace Overview and the left panel's bars show the same figures.

import { linkRequirement } from "../../src/domain/commands/requirement";
import { expect, test, type Page } from "./fixtures";
import {
  asPerson,
  canvasUrl,
  ids,
  loadModel,
  loadRequirementLinks,
  openCanvas,
  openRequirement,
  RETAIL,
  requirementByKey,
  requirementLinkedTo,
  requirementRow,
  SEED_IDS,
  signInAs,
} from "./helpers";

const gaps = (page: Page) => page.getByTestId("item-req-gap").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText.split("\n")[0]}: ${(e as HTMLElement).dataset.why}`));
const homeRows = (page: Page) =>
  page.getByTestId("item-project-requirement").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.key} ${(e as HTMLElement).querySelector("[data-testid=text-project-requirement-coverage]")!.textContent}`));

test("S4B1-03: “{m} of {n} covered” with its parts; an entity gap is listed and its click opens the entity; the project home, status bar, Overview and left panel bars agree", async ({ page }) => {
  const { entity, attribute } = await ids();
  // REQ-106 on Order Line (no covered attribute) and on its attribute quantity (not mapped): two items, both gaps
  const key = await requirementLinkedTo({ kind: "entity", id: entity("Order Line").id });
  expect(key).toBe("REQ-106");
  const r106 = await requirementByKey(key);
  const [model, links] = await Promise.all([loadModel(), loadRequirementLinks()]);
  await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    linkRequirement(ctx, access, { requirement: r106, links, ...model }, { requirementId: r106.id, target: { kind: "attribute", id: attribute("Order Line", "quantity").id } }),
  );

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, key);
  await expect(page.getByTestId("text-req-coverage")).toHaveText("0 of 2 covered");
  await expect(page.getByTestId("text-req-coverage")).toHaveAttribute("title", "1 entity, 1 attribute");
  // the entity item first, then the attribute item as before
  await expect(gaps(page)).resolves.toEqual(["Order Line: no approved mapping on any attribute", "Order Line.quantity: unmapped"]);
  await expect(requirementRow(page, key).getByTestId("bar-req-coverage")).toHaveAttribute("title", "0 of 2 covered (1 entity, 1 attribute)");

  // a click on the entity gap goes to the entity
  await page.getByTestId("item-req-gap").filter({ hasText: "no approved mapping" }).click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Order Line");

  // the status bar, the project home and the Overview count it as not covered, with the seed's three covered
  await expect(page.getByTestId("status-requirements")).toHaveText("Requirements 6, covered 3");
  await page.goto(`/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`);
  await expect(page.getByTestId("stat-requirements")).toHaveText("6 requirements, 3 covered");
  await expect.poll(() => homeRows(page)).toContain("REQ-106 0/2, Draft");
  await expect.poll(() => homeRows(page)).toContain("REQ-101 1/1, Agreed");
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("stat-workspace-requirements")).toHaveText("3 of 6 requirements covered");
  // back on the canvas: the left panel's bar for REQ-101, one entity item
  await openCanvas(page, canvasUrl());
  if ((await page.getByTestId("tab-requirements").getAttribute("aria-selected")) !== "true") await page.getByTestId("tab-requirements").click();
  await expect(requirementRow(page, "REQ-101").getByTestId("bar-req-coverage")).toHaveAttribute("title", "1 of 1 covered (1 entity)");
});
