import type { Page } from "@playwright/test";
import { callActionDirectly, captureActionId, type SeedUserName } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { addPerson, closeLinkDialog, expectToast, openPeople, personRow, SEED_IDS, signInAs } from "./helpers";

const DWH = SEED_IDS.wsRetailDwh;
const ARCHIVED = "This workspace is archived, so it is read-only.";
const PASSWORD_REFUSAL = "Only the owners and admins of InfoMate can change its password.";

/**
 * The writes' action ids, from Łukasz's clicks in Retail Co – DWH: he invites someone (slice 33: "Invite person"
 * replaced "Add person"), changes the role of Ola (added through the domain), removes her and sets InfoMate's password
 * to demo-pass again, so the seed's people and password are as before.
 */
async function actionIds(page: Page) {
  await addPerson(SEED_IDS.userLukasz, DWH, { name: "Ola", email: "ola@example.com", role: "modeler" });
  await signInAs(page, "Łukasz");
  await openPeople(page, DWH);
  const box = page.getByTestId("box-invite-person");
  await box.getByTestId("input-invite-email").fill("someone@example.com");
  const add = await captureActionId(page, () => box.getByTestId("button-create-invitation").click());
  await expect(page.getByTestId("dialog-link")).toBeVisible();
  await closeLinkDialog(page);
  const role = await captureActionId(page, async () => {
    await personRow(page, "Ola").getByTestId("select-person-role").selectOption("reader");
  });
  await expectToast(page, "Ola is now Reader.");
  await personRow(page, "Ola").getByTestId("button-remove-person").click();
  await expect(page.getByTestId("button-confirm-remove-person")).toBeEnabled();
  const remove = await captureActionId(page, () => page.getByTestId("button-confirm-remove-person").click());
  await expectToast(page, "Ola no longer has access.");
  const access = page.getByTestId("box-organization-access");
  await access.getByTestId("input-new-password").fill("demo-pass");
  await access.getByTestId("input-new-password-again").fill("demo-pass");
  await access.getByTestId("button-password-continue").click();
  const password = await captureActionId(page, () => access.getByTestId("button-change-password").click());
  await expectToast(page, "Changed the password of InfoMate.");
  return { add, role, remove, password };
}

async function expectNoPeopleControls(page: Page) {
  await expect(page.getByTestId("table-people")).toBeVisible();
  for (const id of ["box-invite-person", "table-pending", "select-person-role", "button-remove-person", "box-organization-access"]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
}

test("S8-12: modelers, reviewers and readers see no Invite, no pending invitations, no role select, no Remove and no access box; the server refuses each write", async ({ page }) => {
  const ids = await actionIds(page);
  const cases: [SeedUserName, string][] = [
    ["Anna Nowak", "modeler"],
    ["Piotr Wiśniewski", "reviewer"],
    ["Kasia Zielińska", "reader"],
  ];
  for (const [who, role] of cases) {
    await signInAs(page, who);
    await openPeople(page, DWH);
    await expectNoPeopleControls(page);
    const refusal = `As a ${role} you cannot change who has access.`;
    expect(await callActionDirectly(page, ids.add, [{ workspaceId: DWH, email: "ola.again@example.com", role: "modeler" }])).toContain(refusal);
    expect(await callActionDirectly(page, ids.role, [{ workspaceId: DWH, userId: SEED_IDS.userLukasz, role: "reader" }])).toContain(refusal);
    expect(await callActionDirectly(page, ids.remove, [{ workspaceId: DWH, userId: SEED_IDS.userLukasz }])).toContain(refusal);
    expect(
      await callActionDirectly(page, ids.password, [{ workspaceId: DWH, password: "taken-over", passwordAgain: "taken-over", expectedVersion: 2 }]),
    ).toContain(PASSWORD_REFUSAL);
  }
});

test("S8-12: an archived workspace shows no people controls and refuses people changes and the password change", async ({ page }) => {
  const ids = await actionIds(page);
  const ws = SEED_IDS.wsBankX;
  await page.goto(`/w/${ws}?tab=people`);
  await expectNoPeopleControls(page);
  expect(await callActionDirectly(page, ids.add, [{ workspaceId: ws, email: "ola.again@example.com", role: "modeler" }])).toContain(ARCHIVED);
  expect(await callActionDirectly(page, ids.role, [{ workspaceId: ws, userId: SEED_IDS.userAnna, role: "reader" }])).toContain(ARCHIVED);
  expect(await callActionDirectly(page, ids.remove, [{ workspaceId: ws, userId: SEED_IDS.userAnna }])).toContain(ARCHIVED);
  expect(await callActionDirectly(page, ids.password, [{ workspaceId: ws, password: "taken-over", passwordAgain: "taken-over", expectedVersion: 2 }])).toContain(ARCHIVED);
});
