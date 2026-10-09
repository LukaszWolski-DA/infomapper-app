import { expect, test } from "./fixtures";
import {
  AROUND,
  bundleWithCount,
  canvasUrl,
  collapsedFrame,
  isCollapsed,
  openCanvas,
  pointOnLine,
  relBundle,
  signInAs,
  toolboxLabels,
  FRAMED,
} from "./helpers";

test("S2C-07: clicking a bundle opens its panel: counts by status, the mappings grouped by entity as links, an “Expand” per collapsed end", async ({ page }) => {
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customerAndSales, { name: "People" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  const thirteen = bundleWithCount(page, 13);
  const at = await pointOnLine(thirteen, 0.3);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-bundle");
  await expect(panel).toBeVisible();
  await expect(thirteen).toHaveClass(/\bsel\b/);
  await expect(panel).toContainText("Bundled mappings");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("13 mappings");
  await expect(panel).toContainText("From Tables (collapsed frame) to People (collapsed frame).");
  await expect(panel.getByTestId("bundle-status-counts")).toHaveText("9 approved, 2 in review, 2 draft.");
  await expect(panel.getByText("Into Customer", { exact: true })).toBeVisible();
  await expect(panel.getByText("Into Sales Order", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("item-bundle-mapping")).toHaveCount(13);
  await expect(panel.getByTestId("button-bundle-expand")).toHaveText(["Expand Tables", "Expand People"]);

  // a mapping in it is a link to the mapping
  await panel.getByTestId("item-bundle-mapping").filter({ hasText: "customers.dob" }).click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();

  // back to the bundle; “Expand Tables” expands that frame, the bundle is gone and no longer selected
  const again = await pointOnLine(thirteen, 0.3);
  await page.mouse.click(again.x, again.y);
  await page.getByTestId("panel-bundle").getByTestId("button-bundle-expand").filter({ hasText: "Expand Tables" }).click();
  await expect.poll(() => isCollapsed("Tables")).toBe(false);
  await expect(thirteen).toHaveCount(0);
  await expect(page.getByTestId("panel-bundle")).toHaveCount(0);
  expect(await isCollapsed("People")).toBe(true);
});

test("S2C-07: the bundle's toolbox offers “Show what is inside” and the same expands", async ({ page }) => {
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customerAndSales, { name: "People" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // the toolbox
  expect(await toolboxLabels(page, await pointOnLine(bundleWithCount(page, 13), 0.3))).toEqual(["Show what is inside", "Expand Tables", "Expand People"]);
  await expect(page.getByTestId("panel-bundle")).toBeVisible(); // a right-click selects the bundle first (D-19)
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Expand People" }).click();
  await expect.poll(() => isCollapsed("People")).toBe(false);
  await expect(bundleWithCount(page, 13)).toHaveCount(0);
  expect(await isCollapsed("Tables")).toBe(true);
});

test("S2C-07: a relationship bundle's panel: “Bundled relationships”, the count, the ends, each relationship with its multiplicities as a link, and “Expand”", async ({ page }) => {
  await collapsedFrame(AROUND.customerAndLine, { name: "Ends" }); // Customer and Order Line, Sales Order between them
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  const rels = relBundle(page, "2 relationships");
  const at = await pointOnLine(rels, 0.25);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-bundle");
  await expect(panel).toContainText("Bundled relationships");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("2 relationships");
  await expect(panel).toContainText("Between Sales Order and Ends (collapsed frame).");
  const items = panel.getByTestId("item-bundle-relationship");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "Customer places Sales Order" })).toContainText(/\S+ : \S+/);
  await expect(items.filter({ hasText: "Sales Order contains Order Line" })).toBeVisible();
  await expect(panel.getByTestId("button-bundle-expand")).toHaveText(["Expand Ends"]);
  await items.filter({ hasText: "Customer places Sales Order" }).click();
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
});
