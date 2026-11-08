// S18-07 (slice 18, item 4, F14, F15, F16): deleting the relationship a lookup goes through. Its second click names
// the lookup; afterwards the lookup's panel says the relationship is gone and an approved lookup is in review; one undo
// restores both.

import { seedId } from "../../src/data/local/seed-model";
import { setCubeMappingStatus } from "../../src/modules/infocube/domain/mappings";
import { clickLine } from "../slice-10a/helpers";
import { expect, test } from "./fixtures";
import {
  asPersonOnCube,
  cubeMappingId,
  cubeMappingRow,
  expectToast,
  hydrated,
  liveModel,
  mappingModel,
  openCubeMapping,
  openStar,
  RETAIL,
  SEED_IDS,
  signInAs,
  undoButton,
} from "./helpers";

test("S18-07: the relationship's delete names the lookup; the lookup says its relationship is gone and is in review; one undo restores both", async ({ page }) => {
  const country = cubeMappingId("cust.country_name");
  const locates = seedId(RETAIL, "relationship:country>address");
  // the demo's lookup is a Draft: approved first (as Piotr, the reviewer; four-eyes is off)
  await asPersonOnCube(SEED_IDS.userPiotr, async (ctx, access, s) => {
    const state = await mappingModel(s);
    const m = state.cubeMappings.find((x) => x.id === country)!;
    return setCubeMappingStatus(ctx, access, { ...state, contentAuthorId: SEED_IDS.userAnna }, { mappingId: country, expectedVersion: m.version, status: "approved" });
  });
  expect((await cubeMappingRow(country))?.status).toBe("approved");

  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await clickLine(page, locates);
  const del = page.getByTestId("panel-relationship").getByTestId("button-delete-relationship");
  await del.click();
  await expect(del).toHaveAttribute("data-armed", "true");
  await expect(del).toHaveText("Click again to delete; the lookup of Dim Customer.country_name loses its relationship");
  await del.click();
  await expectToast(page, "Relationship deleted");
  await expect.poll(async () => (await liveModel()).relationships.some((r) => r.id === locates)).toBe(false);
  expect(await cubeMappingRow(country)).toMatchObject({ status: "review", approved_at: null, lookup_relationship_id: locates, deleted_at: null });

  const panel = await openCubeMapping(page, country);
  await expect(panel.getByTestId("note-lookup-gone")).toHaveText("The relationship it went through is gone. Choose another.");
  await expect(panel.getByTestId("note-lookup-sentence")).toHaveCount(0);

  await undoButton(page).click();
  await expectToast(page, "Undone: Delete relationship");
  await expect.poll(async () => (await liveModel()).relationships.some((r) => r.id === locates)).toBe(true);
  expect((await cubeMappingRow(country))?.status).toBe("approved");
  await expect(panel.getByTestId("note-lookup-gone")).toHaveCount(0);
  await expect(panel.getByTestId("note-lookup-sentence")).toBeVisible();
});

test("S18-07: a relationship without a lookup through it is deleted at once, as before", async ({ page }) => {
  const places = seedId(RETAIL, "relationship:customer>order");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await clickLine(page, places);
  await page.getByTestId("panel-relationship").getByTestId("button-delete-relationship").click();
  await expectToast(page, "Relationship deleted");
});
