import { callActionDirectly, captureActionId } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { expectToast, openPeople, personRow, SEED_IDS, signInAs } from "./helpers";

const ROLES = ["Owner", "Admin", "Modeler", "Reviewer", "Reader"];

test("S8-09: changing a role: the select and its toast; your own row is text; an owner gives Owner", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const own = personRow(page, "Łukasz");
  await expect(own.getByTestId("select-person-role")).toHaveCount(0);
  await expect(own.getByTestId("text-person-role")).toHaveText("Owner");
  await expect(own.getByTestId("button-remove-person")).toHaveCount(0);

  const anna = personRow(page, "Anna Nowak").getByTestId("select-person-role");
  await expect(anna.locator("option")).toHaveText(ROLES);
  await anna.selectOption("reviewer");
  await expectToast(page, "Anna Nowak is now Reviewer.");
  await expect(anna).toHaveValue("reviewer");
  await anna.selectOption("owner");
  await expectToast(page, "Anna Nowak is now Owner.");
  await page.reload();
  await expect(personRow(page, "Anna Nowak").getByTestId("select-person-role")).toHaveValue("owner");
});

test("S8-09: an admin offers no Owner and sees owners as text; the server refuses giving or changing Owner", async ({ page }) => {
  // Łukasz captures the role action's id, then makes Anna an admin
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const changeRole = await captureActionId(page, async () => {
    await personRow(page, "Anna Nowak").getByTestId("select-person-role").selectOption("admin");
  });
  await expectToast(page, "Anna Nowak is now Admin.");

  await signInAs(page, "Anna Nowak");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const owner = personRow(page, "Łukasz");
  await expect(owner.getByTestId("text-person-role")).toHaveText("Owner");
  await expect(owner.getByTestId("select-person-role")).toHaveCount(0);
  await expect(owner.getByTestId("button-remove-person")).toHaveCount(0);
  await expect(personRow(page, "Anna Nowak").getByTestId("text-person-role")).toHaveText("Admin");
  const piotr = personRow(page, "Piotr Wiśniewski").getByTestId("select-person-role");
  await expect(piotr.locator("option")).toHaveText(ROLES.slice(1));
  await piotr.selectOption("modeler");
  await expectToast(page, "Piotr Wiśniewski is now Modeler.");

  const call = (userId: string, role: string) => callActionDirectly(page, changeRole, [{ workspaceId: SEED_IDS.wsRetailDwh, userId, role }]);
  expect(await call(SEED_IDS.userPiotr, "owner")).toContain("Only an owner can make someone an owner.");
  expect(await call(SEED_IDS.userLukasz, "reader")).toContain("Only an owner can change an owner's role.");
  expect(await call(SEED_IDS.userAnna, "modeler")).toContain("You cannot change your own role.");
});
