import { expect, test } from "./fixtures";
import {
  busFact,
  canvasUrl,
  entityIdOf,
  expectSelected,
  grantLicence,
  hydrated,
  openBusMatrix,
  openCanvas,
  openStar,
  recordToasts,
  signInAs,
  switchRefusal,
  toasts,
  workspaceRow,
} from "./helpers";
import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { SEED_IDS } from "../../src/data/local/seed";

// S15-16 (B-8, IC-13; R-8): the bus matrix from the Cube tab. Two facts × three dimensions with their grains and SCD
// types; Dim Customer and Dim Date conformed, Dim Product used by one fact; a name opens its entity (its card here, or
// its panel when the card is not on this canvas) and a dot its relationship; readers open it too; a workspace with
// InfoCube on but without facts or dimensions gets a toast instead.

test("S15-16: two facts × three dimensions, conformed dimensions, names and dots open their objects", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await page.getByTestId("tab-cube").click();
  await expect(page.getByTestId("button-bus-matrix")).toHaveAttribute("title", "Facts × dimensions");
  let dialog = await openBusMatrix(page);
  await expect(dialog).toContainText("Retail Co – DWH · InfoCube");
  await expect(dialog).toContainText("Built from the relationships; click a name or a dot to open it.");
  await expect(dialog.getByTestId("bus-fact")).toHaveCount(2);
  await expect(busFact(dialog, entityIdOf("sales"))).toContainText("One order line");
  await expect(busFact(dialog, entityIdOf("orders"))).toContainText("One sales order");
  await expect(dialog.getByTestId("bus-dimension")).toHaveText([/^Dim Customer\s*SCD 2$/, /^Dim Product\s*SCD 1$/, /^Dim Date\s*SCD 0$/]);
  await expect(dialog.getByTestId("bus-used-by")).toHaveText([/^2 facts\s*conformed$/, /^1 fact$/, /^2 facts\s*conformed$/]);
  await expect(dialog.getByTestId("bus-dot")).toHaveCount(6);
  await expect(dialog).toContainText("● the fact carries the dimension's key · ○ related, key missing");

  // a name opens its entity, the dialog closes
  await dialog.locator('[data-testid="bus-dimension"]').filter({ hasText: "Dim Product" }).getByTestId("bus-open-entity").click();
  await expect(dialog).toHaveCount(0);
  await expectSelected(page, "entity:Dim Product");
  // a dot opens its relationship
  dialog = await openBusMatrix(page);
  await busFact(dialog, entityIdOf("orders")).getByTestId("bus-dot").first().click();
  await expect(dialog).toHaveCount(0);
  await expectSelected(page, "relationship");
  // Close
  dialog = await openBusMatrix(page);
  await dialog.getByTestId("button-bus-close").click();
  await expect(dialog).toHaveCount(0);
});

test("S15-16: on a canvas without the star a name opens the entity's panel; a reader opens the matrix too", async ({ page }) => {
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page);
  await hydrated(page);
  const dialog = await openBusMatrix(page);
  await expect(dialog.getByTestId("bus-fact")).toHaveCount(2);
  await busFact(dialog, entityIdOf("sales")).getByTestId("bus-open-entity").click();
  await expectSelected(page, "entity:Fact Sales");
  // a reader has no creates, only the matrix
  await expect(page.getByTestId("button-new-fact")).toHaveCount(0);
});

test("S15-16: InfoCube on without facts or dimensions: the toast, no dialog", async ({ page }) => {
  // test data: Retail Co's licence and InfoCube on in its workspace "Sales analytics", which has no fact or dimension
  const ws = SEED_IDS.wsSales;
  await grantLicence((await workspaceRow(ws))!.organization_id);
  expect(await switchRefusal(SEED_IDS.userMarek, true, ws)).toBeNull(); // the owner may switch it on
  const db = await readDb(E2E_DB);
  db.workspace.find((w) => w.id === ws)!.infocube = true;
  await writeDb(E2E_DB, db);
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(canvasUrl(SEED_IDS.canvasSalesFirst, SEED_IDS.projSalesFirst, ws));
  await hydrated(page);
  await page.getByTestId("tab-cube").click();
  await page.getByTestId("button-bus-matrix").click();
  await expect.poll(() => toasts(page)).toContain("No facts or dimensions yet.");
  await expect(page.getByTestId("dialog-bus-matrix")).toHaveCount(0);
});
