import { expect, test } from "./fixtures";
import { card, chipNames, labelsField, loadLabels, loadLinks, mappingLine, openCanvas, pointOnLine, signInAs, typeLabel, canvasUrl, WHOLE_CO } from "./helpers";
import type { Page } from "./fixtures";

/** Gives the item in the right panel the label: the existing one when the name matches in any case. */
async function label(page: Page, typed: string) {
  await typeLabel(page, typed);
  await page.keyboard.press("Enter");
  await expect.poll(() => chipNames(page)).toEqual(["JIRA-900"]);
}

test("S3A-02: a label goes on an entity, attribute, mapping, source table and source column; the same name in another case uses the existing label", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  // an entity: a new label
  await card(page, "Sales Order").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await label(page, "JIRA-900");

  // an attribute, a table and a column of it: “jira-900” is the same label, not a new one
  await card(page, "Sales Order").locator(".row[data-row]").first().click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await typeLabel(page, "jira-900");
  await expect(labelsField(page).locator("..").getByTestId("option-label").first()).toHaveAttribute("data-kind", "use");
  await page.keyboard.press("Enter");
  await expect.poll(() => chipNames(page)).toEqual(["JIRA-900"]);

  await card(page, "order_header").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await label(page, "Jira-900");
  await card(page, "order_header").locator(".row[data-row]").first().click();
  await expect(page.getByTestId("panel-source-column")).toBeVisible();
  await label(page, "JIRA-900");

  // a mapping, chosen by its line
  const line = page.getByTestId("line-mapping").first();
  const mappingId = (await line.getAttribute("data-mapping"))!;
  const p = await pointOnLine(mappingLine(page, mappingId));
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await label(page, "jira-900");

  // one label, five links, one on each kind of item
  const labels = (await loadLabels()).filter((l) => l.name_key === "jira-900");
  expect(labels.map((l) => l.name)).toEqual(["JIRA-900"]);
  const links = (await loadLinks()).filter((k) => k.label_id === labels[0]!.id);
  expect(links).toHaveLength(5);
  for (const col of ["entity_id", "attribute_id", "mapping_id", "source_table_id", "source_column_id"] as const) {
    expect(links.filter((k) => k[col] !== null), col).toHaveLength(1);
  }
  expect(links.find((k) => k.mapping_id)!.mapping_id).toBe(mappingId);
});
