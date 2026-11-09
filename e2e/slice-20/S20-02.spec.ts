// S20-02 (the project home, PRD items 1–2, B1, F): "Model checks" after Model consistency with its badge, High first;
// 20 lines per group and "Show all {n}" / "Show the first 20" over 20 (the rest read on demand); the all-well text on a
// project without lines; the stats' link scrolls to the section; a line opens the right canvas and selects its object
// (an attribute, a relationship, a dimensional mapping); Customer 360 shows only its own scope.

import { readDb, writeDb } from "../../src/data/local/file";
import { SEED_IDS } from "../../src/data/local/seed";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { C360_HOME, checkGroup, checkLines, checksSection, demoEntity, groupCounts, hydrated, OM_HOME, signInAs } from "./helpers";

/** 21 copies in Customer whose original is gone (test data): 21 lines in "Copies whose original was deleted". */
async function twentyOneLost(): Promise<void> {
  const db = await readDb(E2E_DB);
  const base = db.attribute.find((a) => a.entity_id === demoEntity("customer") && a.name === "email")!;
  for (let i = 0; i < 21; i++) {
    db.attribute.push({ ...base, id: `01a0f9e9-5200-7000-8000-${String(i).padStart(12, "0")}`, name: `lost_${String(i).padStart(2, "0")}`, sort_order: 100 + i, is_pii: false, copied_from_attribute_id: "01a0f9e9-5200-7000-8000-ffffffffffff" });
  }
  await writeDb(E2E_DB, db);
}

test("S20-02: the home's section, its lists, the stats' link, the lines' addresses and the scope", async ({ page }) => {
  await twentyOneLost();
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await hydrated(page);

  // after Model consistency, with its badge and sentence; High first
  const order = await page.locator('[data-testid="section-consistency"], [data-testid="section-checks"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["section-consistency", "section-checks"]);
  await expect(page.getByTestId("checks-badge")).toHaveText("36");
  await expect(page.getByTestId("checks-intro")).toHaveText(
    "What the model itself says, for the entities on this project's canvases: names, calculations, copied keys and InfoCube. Computed when this page opens; nothing is stored or changed.",
  );
  expect((await groupCounts(page)).map(([id]) => id)).toEqual(["wrong", "dup", "calc", "lost", "norel", "nokey", "under"]);
  await expect(checkGroup(page, "wrong")).toHaveAttribute("data-severity", "high");
  await expect(checkGroup(page, "under").getByTestId("check-module")).toHaveText("InfoCube");

  // 20 of 21, the rest on "Show all 21", back on "Show the first 20"
  await expect(checkLines(page, "lost")).toHaveCount(20);
  const all = checkGroup(page, "lost").getByTestId("button-checks-all");
  await expect(all).toHaveText("Show all 21");
  await all.click();
  await expect(checkLines(page, "lost")).toHaveCount(21);
  await expect(all).toHaveText("Show the first 20");
  await all.click();
  await expect(checkLines(page, "lost")).toHaveCount(20);
  await expect(checkGroup(page, "under").getByTestId("button-checks-all")).toHaveCount(0);

  // the stats' link: orange (a High line), scrolls to the section
  const stat = page.getByTestId("stat-checks");
  await expect(stat).toHaveText("!36 model checks");
  await expect(stat).toHaveAttribute("data-high", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await stat.click();
  await expect(checksSection(page)).toBeInViewport();

  // a line opens its object: an attribute's row on the first canvas that shows it
  await checkLines(page, "wrong").first().click();
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}`));
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("input-attribute-name")).toHaveValue("last_order_id");
  // a relationship (Country – Customer Address: Country is only on the Sales star)
  await page.goto(OM_HOME);
  await checkLines(page, "nokey").first().click();
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
  await expect(page.getByTestId("panel-relationship")).toContainText("Country and Customer Address");
  // a dimensional mapping (its target's card on the Sales star)
  await page.goto(OM_HOME);
  await checkLines(page, "under").filter({ hasText: "Dim Customer.segment_code" }).click();
  await expect(page.getByTestId("panel-cube-mapping")).toBeVisible();
  await expect(page.getByTestId("panel-cube-mapping").getByTestId("box-model-checks")).toBeVisible();

  // Customer 360: only its own scope (Customer, Sales Order, Order Line)
  await page.goto(C360_HOME);
  await hydrated(page);
  expect(await groupCounts(page)).toEqual([
    ["wrong", 1],
    ["calc", 1],
    ["lost", 21],
    ["under", 7],
  ]);

  // a project without lines: the all-well text, no stats' link
  await page.goto(`/w/${SEED_IDS.wsBankX}/p/${SEED_IDS.projBankFirst}`);
  await hydrated(page);
  await expect(page.getByTestId("text-checks-ok")).toHaveText("Names, calculations and keys agree. Nothing to look at.");
  await expect(page.getByTestId("stat-checks")).toHaveCount(0);
  await expect(page.getByTestId("checks-badge")).toHaveCount(0);
});
