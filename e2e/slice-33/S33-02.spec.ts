// S33-02 (criterion 2): accepting, on the local adapter (D3: no password; the person signed in with only the
// invitation's organization unlocked). The page names the organization, the workspace and the role; the e-mail is the
// invitation's and cannot be changed; a used, revoked or expired link shows the one message and changes nothing; the
// archived workspace's own message (D7); the inviter sees the person and the invitation leaves the pending list.
import { expect, test } from "./fixtures";
import {
  changeDb,
  closeLinkDialog,
  DWH,
  expectGone,
  inviteAs,
  inviteInBox,
  joinByLink,
  openPeople,
  pendingRow,
  personRow,
  SEED_IDS,
  signInAs,
  stored,
} from "./helpers";

test("S33-02: a new person: the page names the organization, the workspace and the role; Join; the link then shows the one message", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const link = await inviteInBox(page, "new.person@example.com", "reviewer");
  await closeLinkDialog(page);

  const context = await browser.newContext();
  const them = await context.newPage();
  await them.goto(link);
  await expect(them.getByTestId("title-link")).toHaveText("Join InfoMate");
  await expect(them.getByTestId("text-invited")).toHaveText(`Łukasz invited you to ${DWH} in InfoMate as Reviewer.`);
  await expect(them.getByTestId("input-join-email")).toHaveValue("new.person@example.com");
  await expect(them.getByTestId("input-join-email")).toBeDisabled();
  // locally there is no password to set (D3)
  await expect(them.getByTestId("input-join-password")).toHaveCount(0);
  await joinByLink(them, link, "New Person");
  await expect(them).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(them.getByTestId("indicator-user-role")).toHaveText("Reviewer");

  // the same link again: the one message, nothing changed
  const before = await stored();
  await expectGone(them, link);
  const after = await stored();
  expect(after.app_user).toHaveLength(before.app_user.length);
  expect(after.workspace_member).toHaveLength(before.workspace_member.length);
  await context.close();

  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(personRow(page, "New Person")).toContainText("Reviewer");
  await expect(pendingRow(page, "new.person@example.com")).toHaveCount(0);
  const events = after.change_event.filter((e) => e.object_type === "invitation");
  // the hash never in a change event (F6)
  for (const e of events) for (const image of [e.before_image, e.after_image]) if (image) expect(image.token_hash).toMatch(/^\((un)?changed\)$/);
});

test("S33-02: a person with an account joins and gets this workspace beside their others; their other organizations stay locked", async ({ page, browser }) => {
  // Marek owns Retail Co; invited into InfoMate's workspace
  const { token } = await inviteAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, "m.lis@retailco.com", "modeler");
  const context = await browser.newContext();
  const marek = await context.newPage();
  const link = `/invite/${token}`;
  await marek.goto(link);
  await expect(marek.getByTestId("form-join")).toHaveAttribute("data-kind", "existing");
  await expect(marek.getByTestId("input-join-name")).toHaveCount(0);
  await joinByLink(marek, link);
  await expect(marek).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(marek.getByTestId("indicator-user-role")).toHaveText("Modeler");
  // Retail Co was not unlocked by the link (D-58): its pages ask for its password
  await marek.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(marek).toHaveURL(/\/sign-in\?org=/);
  await context.close();

  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(personRow(page, "Marek Lis")).toContainText("Modeler");
});

test("S33-02: a revoked link and an expired one show the one message and change nothing", async ({ page }) => {
  const revoked = await inviteAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, "revoked@example.com", "modeler");
  const expired = await inviteAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, "expired@example.com", "modeler");
  await changeDb((db) => {
    const at = new Date().toISOString();
    db.invitation.find((i) => i.id === revoked.invitationId)!.revoked_at = at;
    db.invitation.find((i) => i.id === expired.invitationId)!.expires_at = "2026-01-01T10:00:00.000Z";
  });
  const before = await stored();
  for (const token of [revoked.token, expired.token]) await expectGone(page, `/invite/${token}`);
  expect((await stored()).app_user).toHaveLength(before.app_user.length);
});

test("S33-02: a workspace archived after the link was made: its own message (D7), and nothing changes", async ({ page }) => {
  const { token } = await inviteAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, "late.joiner@example.com", "reader");
  await changeDb((db) => {
    const w = db.workspace.find((x) => x.id === SEED_IDS.wsRetailDwh)!;
    w.archived_at = new Date().toISOString();
    w.archived_by = SEED_IDS.userLukasz;
  });
  await page.goto(`/invite/${token}`);
  await expect(page.getByTestId("title-link")).toHaveText("Invitation");
  await expect(page.getByTestId("text-link-gone")).toHaveText(`${DWH} is archived, so nobody can join it now. Nothing was changed.`);
  expect((await stored()).app_user.some((u) => u.email === "late.joiner@example.com")).toBe(false);
});
