import { expect, test } from "./fixtures";
import { cubeStore, infocubeCheck, settingsUrl, signInAs, workspaceRow } from "./helpers";
import { E2E_DB } from "../config";
import { SEED_IDS } from "../slice-01a/helpers";

// S15-03 (R1, slice 15b): as the prototype, the InfoCube box stays ticked and enabled for an owner while InfoCube is on,
// even when the organization no longer holds the licence; the licence's line says so. (Turning it off is refused while
// the workspace has facts or dimensions: S15-04.)

test("S15-03 (R1): with InfoCube on and no licence the box is ticked and enabled, with the no-licence line", async ({ page }) => {
  // the licence ended (test data only: no command ends a licence in this slice)
  const { readDb, writeDb } = await import("../../src/data/local/file");
  const db = await readDb(E2E_DB);
  db.organization_licence = db.organization_licence.filter((l) => l.organization_id !== SEED_IDS.orgInfoMate);
  await writeDb(E2E_DB, db);
  expect((await workspaceRow()).infocube).toBe(true);
  expect(await cubeStore().organizations.listLicences(SEED_IDS.orgInfoMate)).toEqual([]);

  await signInAs(page, "Łukasz");
  await page.goto(settingsUrl());
  await expect(infocubeCheck(page)).toBeChecked();
  await expect(infocubeCheck(page)).toBeEnabled();
  await expect(page.getByTestId("text-infocube-licence")).toHaveText("InfoMate has no InfoCube licence.");
});
