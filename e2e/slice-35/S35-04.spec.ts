// S35-04 (slice 35, criterion 4 as changed, section 8 of the acceptance doc; B1.6, B2.3, B4.2, B4.6): every member sees
// "Compare…" on each baseline, in an archived workspace too. "Compared with" (Now by default, or any other baseline,
// newest first), "Filter" and "Kind" in one row; the older state is always the start; the line, the groups Added,
// Changed and Removed, each a table of Kind, Item and What changed; short values old → new, long texts "(changed)", ids
// by name. "cust" finds customers.cust_no, Customer.segment_code and the mapping from cust_no. Locally the demo's
// "Stage 1 sign-off" compared with Now shows the mapping whose status changed and customers.cust_no's type. A baseline
// gone meanwhile: "This baseline no longer exists." (F17).
import { test, expect } from "./fixtures";
import { deleteBaseline } from "../../src/domain/commands/baseline";
import { archive, asPersonHere, compareRows, createInBox, DEMO_BASELINE, expectToast, minute, openBaselines, openCompare, rowNamed, signInAs, SEED_IDS, storedBaseline } from "./helpers";

test.use({ seed: "full" });

const STAGE1 = [
  "Attribute | Customer.segment_code | ",
  "Mapping | customers.cust_no → Customer.customer_number | status: Draft → Approved",
  "Requirement | REQ-105 Personal data is encrypted at rest | ",
  "Source column | CRM · customers.cust_no | type: varchar(10) → varchar(20)",
];

test("S35-04: Compare… with Now and with another baseline, the line, the groups, the filter and the kind", async ({ page }) => {
  // a Reader (a guest) compares
  await signInAs(page, "Kasia Zielińska");
  await openBaselines(page);
  let dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("text-dialog-subtitle")).toHaveText("Retail Co – DWH");
  await expect(dialog.getByRole("heading", { name: `Compare “${DEMO_BASELINE.name}”` })).toBeVisible();
  const at = minute(DEMO_BASELINE.at);
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
  // the groups in order, each a table
  await expect(dialog.locator("h4")).toHaveText(["Added (2)", "Changed (2)"]);
  await expect(dialog.locator("[data-testid=compare-group-added] th")).toHaveText(["Kind", "Item", "What changed"]);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[2], STAGE1[1], STAGE1[3]]);
  // the controls in one row at 1440 px: the same top for all three
  const tops = await topsOf(dialog);
  // a search input and a select may differ by half a pixel
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)"]);
  await expect(dialog.getByTestId("select-compare-kind").locator("option")).toHaveText(["All kinds", "Entity", "Attribute", "Mapping", "Relationship", "Requirement", "Source table", "Source column"]);
  await expect(dialog.getByTestId("input-compare-filter")).toHaveAttribute("placeholder", "A name, e.g. Customer or cust_no");

  // the filter in any letter case, the kind, nothing left
  await dialog.getByTestId("input-compare-filter").fill("CUST");
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now; 3 shown by the filter.`);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[1], STAGE1[3]]);
  await dialog.getByTestId("select-compare-kind").selectOption({ label: "Source column" });
  expect(await compareRows(dialog)).toEqual([STAGE1[3]]);
  await dialog.getByTestId("input-compare-filter").fill("nothing like this");
  await expect(dialog.getByTestId("text-compare-nothing")).toHaveText("Nothing matches the filter.");
  await dialog.getByTestId("button-close-compare").click();

  // another baseline, newer: whichever row it is opened from, the older state is the start
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await createInBox(page, "Stage 2 sign-off");
  await expectToast(page, "Created the baseline Stage 2 sign-off.");
  const stage2 = minute((await storedBaseline("Stage 2 sign-off"))!.created_at);
  dialog = await openCompare(page, "Stage 2 sign-off");
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`No changes from “Stage 2 sign-off” (${stage2}) to now.`);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)", `${DEMO_BASELINE.name} (${at})`]);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `${DEMO_BASELINE.name} (${at})` });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to “Stage 2 sign-off” (${stage2}).`);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[2], STAGE1[1], STAGE1[3]]);
  await dialog.getByTestId("button-close-compare").click();
  dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)", `Stage 2 sign-off (${stage2})`]);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `Stage 2 sign-off (${stage2})` });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to “Stage 2 sign-off” (${stage2}).`);

  // gone meanwhile (F17): the next answer says so and the dialog closes
  const s2 = (await storedBaseline("Stage 2 sign-off"))!;
  await asPersonHere(SEED_IDS.userLukasz, (ctx, access) => deleteBaseline(ctx, access, s2, { baselineId: s2.id, expectedVersion: s2.version }));
  // Now still compares; the deleted one, chosen again, is gone
  await dialog.getByTestId("select-compare-with").selectOption({ label: "Now (the live model)" });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `Stage 2 sign-off (${stage2})` });
  await expectToast(page, "This baseline no longer exists.");
  await expect(dialog).toHaveCount(0);
  await expect(rowNamed(page, "Stage 2 sign-off")).toHaveCount(0);

  // archived: Compare stays
  await archive();
  await page.reload();
  dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
});

test("S35-04: on a narrow window the three controls wrap", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 900 });
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  const dialog = await openCompare(page, DEMO_BASELINE.name);
  const tops = await topsOf(dialog);
  expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(20);
  // the page has no horizontal scroll
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/** The three controls' tops, read in one go (the centred dialog moves while its list grows). */
const topsOf = (dialog: import("@playwright/test").Locator) =>
  dialog.evaluate((d) => ["select-compare-with", "input-compare-filter", "select-compare-kind"].map((id) => d.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top));
