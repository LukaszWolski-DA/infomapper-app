// S33-01 (criterion 1): the invitation. An Owner or Admin invites by e-mail and role and gets a link with Copy, shown
// once; the invitation is listed as pending with its expiry; New link and Revoke; other roles see no "Invite person".
import { expect, test } from "./fixtures";
import { changeDb, changeRoleAs, closeLinkDialog, DWH, expectGone, expectToast, inviteInBox, openPeople, pendingRow, SEED_IDS, signInAs, storedInvitations } from "./helpers";

const LINK = /^http:\/\/(localhost|127\.0\.0\.1):\d+\/invite\/[A-Za-z0-9_-]{43}$/;

test("S33-01: an Owner invites: the link dialog with Copy, shown once; only the hash is stored; the pending row with its expiry", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const box = page.getByTestId("box-invite-person");
  await expect(box).toContainText("You get a link to copy and send yourself (e-mail, Teams). It works once, for 7 days. The person sets their own password.");
  await expect(box.getByTestId("select-invite-role").locator("option")).toHaveText(["Admin", "Modeler", "Reviewer", "Reader"]);

  const link = await inviteInBox(page, "jan.kowalski@example.com", "reviewer");
  const dialog = page.getByTestId("dialog-link");
  await expect(dialog.getByRole("heading")).toHaveText("Invitation link");
  expect(link).toMatch(LINK);
  await expect(dialog.getByTestId("text-link-valid")).toHaveText("It works once, for 7 days. Shown only now: if it gets lost, make a new link.");
  await dialog.getByTestId("button-copy-link").click();
  await expectToast(page, "Link copied.");
  await closeLinkDialog(page);

  // the token is in no stored row: only its SHA-256
  const [row0] = await storedInvitations();
  expect(row0).toMatchObject({ email: "jan.kowalski@example.com", role: "reviewer", invited_by: SEED_IDS.userLukasz, accepted_at: null, revoked_at: null });
  expect(row0!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(await storedInvitations())).not.toContain(link.split("/").pop()!);

  const row = pendingRow(page, "jan.kowalski@example.com");
  await expect(row).toContainText("Reviewer");
  const expiry = new Date(row0!.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Warsaw" });
  await expect(row.getByTestId("text-pending-expiry")).toHaveText(`· expires ${expiry}`);
  // the people table does not mix in invitations
  await expect(page.getByTestId("table-people")).not.toContainText("jan.kowalski@example.com");
  // after a reload the link is nowhere on the page: shown only once
  await page.reload();
  await expect(page.getByTestId("dialog-link")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(link);
});

test("S33-01: New link: a new link for 7 days, the earlier one stops working; Revoke: the link stops working and the row goes", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const first = await inviteInBox(page, "jan.kowalski@example.com");
  await closeLinkDialog(page);

  await pendingRow(page, "jan.kowalski@example.com").getByTestId("button-new-link").click();
  const dialog = page.getByTestId("dialog-link");
  await expect(dialog.getByRole("heading")).toHaveText("New invitation link");
  await expect(dialog.getByTestId("text-link-for")).toHaveText("For jan.kowalski@example.com, as Modeler. The earlier link no longer works.");
  const second = await dialog.getByTestId("text-link").innerText();
  expect(second).not.toBe(first);
  await closeLinkDialog(page);
  expect(await storedInvitations()).toHaveLength(1);

  const context = await browser.newContext();
  const other = await context.newPage();
  await expectGone(other, first);
  await other.goto(second);
  await expect(other.getByTestId("form-join")).toBeVisible();

  await pendingRow(page, "jan.kowalski@example.com").getByTestId("button-revoke-invitation").click();
  await expectToast(page, "The invitation to jan.kowalski@example.com is revoked; its link no longer works.");
  await expect(page.getByTestId("table-pending")).toHaveCount(0);
  await expectGone(other, second);
  await context.close();
});

test("S33-01: an expired invitation stays listed as expired (D6), and New link gives it 7 days again", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const link = await inviteInBox(page, "late@example.com");
  await closeLinkDialog(page);
  await changeDb((db) => {
    db.invitation[0]!.expires_at = "2026-01-01T10:00:00.000Z";
  });
  await page.reload();
  await expect(pendingRow(page, "late@example.com").getByTestId("text-pending-expiry")).toHaveText("· expired 1 Jan 2026");
  const context = await browser.newContext();
  const other = await context.newPage();
  await expectGone(other, link);
  await pendingRow(page, "late@example.com").getByTestId("button-new-link").click();
  const fresh = await page.getByTestId("dialog-link").getByTestId("text-link").innerText();
  await closeLinkDialog(page);
  await expect(pendingRow(page, "late@example.com").getByTestId("text-pending-expiry")).toContainText("· expires ");
  await other.goto(fresh);
  await expect(other.getByTestId("form-join")).toBeVisible();
  await context.close();
});

test("S33-01: an Admin invites too; modelers, reviewers and readers see no Invite person and no pending invitations", async ({ page }) => {
  await changeRoleAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, SEED_IDS.userAnna, "admin");
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await inviteInBox(page, "pending@example.com");
  await closeLinkDialog(page);

  await signInAs(page, "Anna Nowak");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(page.getByTestId("box-invite-person")).toBeVisible();
  await expect(pendingRow(page, "pending@example.com")).toBeVisible();
  // an invitation never gives Owner
  await expect(page.getByTestId("select-invite-role").locator("option")).toHaveText(["Admin", "Modeler", "Reviewer", "Reader"]);
  await inviteInBox(page, "by.anna@example.com", "admin");
  await expect(page.getByTestId("text-link-for")).toHaveText(`Send it to by.anna@example.com. They join ${DWH} as Admin.`);
  await closeLinkDialog(page);

  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    await signInAs(page, who);
    await openPeople(page, SEED_IDS.wsRetailDwh);
    await expect(page.getByTestId("box-invite-person")).toHaveCount(0);
    await expect(page.getByTestId("table-pending")).toHaveCount(0);
  }
  await changeRoleAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, SEED_IDS.userAnna, "modeler");
  await signInAs(page, "Anna Nowak");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(page.getByTestId("box-invite-person")).toHaveCount(0);
});
