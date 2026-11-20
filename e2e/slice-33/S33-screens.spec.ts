// Slice 33's screenshots on the local adapter (demo data only): the People tab with a pending and an expired invitation,
// the link dialog, the invite page. On demand: SCREENS=<folder> npm run e2e -- e2e/slice-33/S33-screens.spec.ts
// (skipped otherwise). The online ones are the smoke set's (`e2e/slice-29/S33-smoke-screens.spec.ts`).
import path from "node:path";
import { test } from "./fixtures";
import { changeDb, closeLinkDialog, inviteInBox, openPeople, SEED_IDS, signInAs } from "./helpers";

const folder = process.env.SCREENS;
test.skip(!folder, "SCREENS=<folder> takes the screenshots.");

test("slice 33 screens (local)", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await inviteInBox(page, "old.invite@example.com", "reader");
  await closeLinkDialog(page);
  await changeDb((db) => {
    db.invitation[0]!.expires_at = "2026-11-01T10:00:00.000Z";
  });
  await page.reload();
  const link = await inviteInBox(page, "jan.kowalski@example.com", "reviewer");
  await page.screenshot({ path: path.join(folder!, "local-link-dialog.png") });
  await closeLinkDialog(page);
  await page.getByTestId("table-people").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(folder!, "local-people-tab.png"), fullPage: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const them = await context.newPage();
  await them.goto(link);
  await them.getByTestId("form-join").waitFor();
  await them.screenshot({ path: path.join(folder!, "local-invite-page.png") });
  await context.close();
});
