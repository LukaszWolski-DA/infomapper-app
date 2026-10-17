// S4B1-04 (slice 4b-1, PRD items 14–15): requirement markers on entity and table cards. Their count and tooltip match the
// card's panel (direct and indirect, D-34); a link, an unlink, a deleted requirement and an undo update them; they are
// drawn at 30 %; a click on a marker changes nothing (no selection, no write).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, loadRequirementLinks, openCanvas, openEntityFromTree, openRequirement, requirementByKey, sectionRows, signInAs, WHOLE } from "./helpers";

const marker = (page: Page, name: string) => card(page, name).getByTestId("mark-requirements");
/** The marker's count and the requirement keys of its tooltip, in order. */
const markerOf = async (page: Page, name: string) => {
  const m = marker(page, name);
  if (!(await m.count())) return null;
  const title = (await m.getAttribute("title")) ?? "";
  return { n: Number(await m.getAttribute("data-count")), keys: title.replace(/^Requirements: /, "").split("\n").map((line) => line.split(" ")[0]) };
};

test("S4B1-04: markers on entity and table cards match their panels; link, unlink, delete and undo update them; drawn at 30 %; a click on one changes nothing", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);

  // Customer: REQ-101 directly, REQ-102, REQ-103 and REQ-105 via attribute; its tooltip names them as its panel lists them
  await expect(marker(page, "Customer")).toHaveAttribute("data-count", "4");
  await expect(marker(page, "Customer")).toHaveAttribute("title", /^Requirements: REQ-101 Single view of the customer\n/);
  await openEntityFromTree(page, "Customer");
  const rows = await sectionRows(page);
  expect((await markerOf(page, "Customer"))!.keys).toEqual(rows.map((r) => r.split(" ")[0]));
  // Sales Order and Order Line: REQ-104 via an attribute each; no table has a requirement in the seed
  await expect(marker(page, "Sales Order")).toHaveAttribute("data-count", "1");
  await expect(marker(page, "Order Line")).toHaveAttribute("data-count", "1");
  for (const table of ["customers", "web_users", "order_header", "order_line"]) await expect(marker(page, table), table).toHaveCount(0);

  // a link from the table's panel: order_line gets a marker
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-item").filter({ has: page.getByText("order_line", { exact: true }) }).click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await page.getByTestId("select-link-requirement").selectOption((await requirementByKey("REQ-103")).id);
  await expect(marker(page, "order_line")).toHaveAttribute("data-count", "1");
  // unlinking it takes the marker away
  await page.getByTestId("button-requirement-unlink").click();
  await expect(marker(page, "order_line")).toHaveCount(0);

  // deleting REQ-104 takes Sales Order's and Order Line's markers away; one undo brings them back
  await openRequirement(page, "REQ-104");
  await page.getByTestId("button-delete-requirement").click();
  await expect(marker(page, "Sales Order")).toHaveCount(0);
  await expect(marker(page, "Order Line")).toHaveCount(0);
  await expect(marker(page, "Customer")).toHaveAttribute("data-count", "4");
  await page.getByTestId("button-undo").click();
  await expect(marker(page, "Sales Order")).toHaveAttribute("data-count", "1");
  await expect(marker(page, "Order Line")).toHaveAttribute("data-count", "1");

  // a click on a marker: nothing selected, nothing written (the whole canvas again: the panels above moved the view)
  await openCanvas(page, canvasUrl(), WHOLE);
  await expect(marker(page, "Customer")).toHaveAttribute("data-count", "4");
  const links = (await loadRequirementLinks()).length;
  await marker(page, "Customer").click();
  await expect(page.locator("[data-card].sel")).toHaveCount(0);
  await expect(page.getByTestId("panel-entity")).toHaveCount(0);
  expect((await loadRequirementLinks()).length).toBe(links);

  // at 30 % (cards drawn as header and block) the markers are drawn
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 0.3 });
  await expect(marker(page, "Customer")).toHaveAttribute("data-count", "4");
  await expect(marker(page, "Sales Order")).toHaveAttribute("data-count", "1");
});
