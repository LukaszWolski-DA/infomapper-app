// S19-02 (items 1, 2, 7): Fact Sales as a periodic snapshot shows "Fact · Snapshot", the Cube tab's text and the additive
// measures' hints; as an accumulating snapshot with Dim Date in two roles no "several dates" hint, Fact Orders does;
// factless with measures shows its hint, without measures the Measures text. One undo each.

import { setMeasure } from "../../src/modules/infocube/domain/commands";
import { TYPE_HINTS } from "../../src/modules/infocube/domain/keys";
import { SEED_USERS } from "../../src/data/local/seed";
import { expect, test } from "./fixtures";
import { asCube, cubeItem, cubeRow, factlessFlag, factTypeSeg, hints, openEntity, openStar, roleOf, segment, signInAs, typeEntity, undoButton } from "./helpers";
import { RETAIL } from "../slice-01a/helpers";

test("S19-02: Fact Sales periodic and accumulating, Fact Orders accumulating; one undo each", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await page.getByTestId("tab-cube").click();
  await openEntity(page, "Fact Sales");

  await segment(factTypeSeg(page), "Periodic").click();
  await expect(roleOf(page, "Fact Sales")).toHaveText("Fact · Snapshot");
  await expect(roleOf(page, "Fact Sales")).toHaveAttribute("title", "Periodic snapshot fact (InfoCube)");
  await expect(cubeItem(page, "Fact Sales")).toContainText("Snapshot · grain set");
  await expect(page.getByTestId("text-cube-fact-type")).toHaveText(
    "Periodic snapshot. One row per period and its dimensions (e.g. a month-end balance), whether or not anything happened.",
  );
  await expect(hints(page).filter({ hasText: "is additive" })).toHaveText([TYPE_HINTS.periodic("quantity"), TYPE_HINTS.periodic("net_amount")]);
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRow(typeEntity("sales")))?.fact_type).toBe("transaction");
  await expect(roleOf(page, "Fact Sales")).toHaveText("Fact");
  await expect(hints(page).filter({ hasText: "is additive" })).toHaveCount(0);

  await segment(factTypeSeg(page), "Accumulating").click();
  await expect(roleOf(page, "Fact Sales")).toHaveText("Fact · Accumulating");
  await expect.poll(async () => (await cubeRow(typeEntity("sales")))?.fact_type).toBe("accumulating");
  await expect(hints(page).filter({ hasText: TYPE_HINTS.accumulating })).toHaveCount(0);

  await openEntity(page, "Fact Orders");
  await segment(factTypeSeg(page), "Accumulating").click();
  await expect(hints(page).filter({ hasText: TYPE_HINTS.accumulating })).toHaveCount(1);
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRow(typeEntity("orders")))?.fact_type).toBe("transaction");
  await expect(hints(page).filter({ hasText: TYPE_HINTS.accumulating })).toHaveCount(0);
});

test("S19-02: factless with measures shows its hint, without measures the Measures text; one undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openEntity(page, "Fact Orders");
  await factlessFlag(page).click();
  await expect(factlessFlag(page)).toHaveAttribute("aria-pressed", "true");
  await expect(roleOf(page, "Fact Orders")).toHaveText("Fact · Factless · Aggregate");
  await expect(hints(page).filter({ hasText: "marked factless" })).toHaveText([TYPE_HINTS.factless(["total_amount", "line_count"])]);
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRow(typeEntity("orders")))?.is_factless).toBe(false);
  await expect(hints(page).filter({ hasText: "marked factless" })).toHaveCount(0);

  // Fact Orders without its two measures, as test data through the domain; then factless
  const { store } = { store: (await import("../slice-15a/helpers")).cubeStore() };
  const measures = (await store.modules.list(RETAIL, "cube_measure")).filter((m) => m.deleted_at === null);
  const attributes = (await store.model.load(RETAIL)).attributes.filter((a) => a.entity_id === typeEntity("orders"));
  for (const m of measures.filter((m) => attributes.some((a) => a.id === m.attribute_id))) {
    await asCube(SEED_USERS.lukasz.id, (ctx, access) => setMeasure(ctx, access, { attribute: attributes.find((a) => a.id === m.attribute_id)!, cube: null, measure: m }, { on: false, attributeId: m.attribute_id, measureId: m.id, expectedVersion: m.version }));
  }
  await page.reload();
  await openEntity(page, "Fact Orders");
  await expect(page.getByTestId("section-cube-fact")).toContainText("None yet. Open a numeric attribute and turn on Measure.");
  await factlessFlag(page).click();
  await expect(page.getByTestId("section-cube-fact")).toContainText("None: a factless fact. Count its rows.");
  await expect(page.getByTestId("text-cube-factless")).toHaveText("It records that something happened, or could happen, with no amounts: counting its rows is its measure.");
  await expect(hints(page).filter({ hasText: "marked factless" })).toHaveCount(0);
  await undoButton(page).click();
  await expect(page.getByTestId("section-cube-fact")).toContainText("None yet. Open a numeric attribute and turn on Measure.");
});
