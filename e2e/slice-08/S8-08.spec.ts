import { createFromSwitcher } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { expectToast, openPeople, personRow, SEED_IDS, signInAs, signOutViaMenu } from "./helpers";

const DWH = "Retail Co – DWH";
const SIGN_IN = "They sign in with the link of InfoMate and its password.";

test("S8-08: adding a new person: the summary, Back, Add; they sign in with the link and see only their workspace", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const box = page.getByTestId("box-add-person");
  await expect(box.getByTestId("select-add-person-role")).toHaveValue("modeler");

  await box.getByTestId("button-add-person-continue").click();
  await expect(box.getByTestId("message-field").first()).toHaveText("Enter a name.");

  await box.getByTestId("input-add-person-name").fill("Ola Nowa");
  await box.getByTestId("input-add-person-email").fill("  Ola@Example.com ");
  await box.getByTestId("select-add-person-role").selectOption("reviewer");
  await box.getByTestId("button-add-person-continue").click();
  await expect(box.getByTestId("text-add-person-summary")).toHaveText(`Ola Nowa (ola@example.com) gets the role Reviewer in ${DWH}. ${SIGN_IN}`);
  await box.getByTestId("button-add-person-back").click();
  await expect(box.getByTestId("input-add-person-name")).toHaveValue("Ola Nowa");
  await expect(personRow(page, "Ola Nowa")).toHaveCount(0);

  await box.getByTestId("button-add-person-continue").click();
  await box.getByTestId("button-add-person").click();
  await expectToast(page, `Added Ola Nowa to ${DWH} as Reviewer.`);
  await expect(personRow(page, "Ola Nowa")).toContainText("ola@example.com");
  await expect(page.getByTestId("tab-people")).toHaveText("People (5)");

  // the new person: InfoMate's link and its password; only the workspace she was added to
  await signOutViaMenu(page);
  await page.goto(`/sign-in?org=${SEED_IDS.orgInfoMate}`);
  const form = page.getByTestId("panel-organization-link");
  await form.getByTestId("input-sign-in-email").fill("ola@example.com");
  await form.getByTestId("input-sign-in-password").fill("demo-pass");
  await form.getByTestId("button-sign-in").click();
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Reviewer");
  await page.getByTestId("switcher-workspace").click();
  await expect(page.getByTestId("menu-item-workspace")).toHaveCount(1);
  await expect(page.getByTestId("menu-item-workspace")).toContainText(DWH);
  await page.keyboard.press("Escape");
  expect((await page.goto(`/w/${SEED_IDS.wsBankX}`))?.status()).toBe(404);
});

test("S8-08: an account linked to this organization keeps its name; one from elsewhere is named by e-mail only (F11); someone already in is refused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  // a second InfoMate workspace without Piotr
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await createFromSwitcher(page, "switcher-workspace", "input-new-workspace", "Second");
  await expectToast(page, "Created the workspace Second.");
  await expect(page.getByTestId("switcher-workspace")).toHaveText("Second");
  const workspaceId = /\/w\/([^/?]+)/.exec(page.url())![1]!;
  await openPeople(page, workspaceId);
  const box = page.getByTestId("box-add-person");

  // Piotr has a workspace in InfoMate: his account's name stays and is shown
  await box.getByTestId("input-add-person-name").fill("Pete");
  await box.getByTestId("input-add-person-email").fill("piotr.w@infomate.pl");
  await box.getByTestId("button-add-person-continue").click();
  await expect(box.getByTestId("text-add-person-summary").locator("p")).toHaveText([
    `Piotr Wiśniewski (piotr.w@infomate.pl) gets the role Modeler in Second. ${SIGN_IN}`,
    "piotr.w@infomate.pl already has an account as Piotr Wiśniewski; that name stays.",
  ]);
  await box.getByTestId("button-add-person").click();
  await expectToast(page, "Added Piotr Wiśniewski to Second as Modeler.");
  await expect(personRow(page, "Piotr Wiśniewski")).toBeVisible();

  // Marek is Retail Co's: InfoMate's page never shows his name
  await box.getByTestId("input-add-person-name").fill("Somebody");
  await box.getByTestId("input-add-person-email").fill("m.lis@retailco.com");
  await box.getByTestId("button-add-person-continue").click();
  await expect(box.getByTestId("text-add-person-summary").locator("p")).toHaveText([
    `m.lis@retailco.com gets the role Modeler in Second. ${SIGN_IN}`,
    "m.lis@retailco.com already has an account; they keep their own name.",
  ]);
  await box.getByTestId("button-add-person").click();
  await expectToast(page, "Added m.lis@retailco.com to Second as Modeler.");

  // already in
  await box.getByTestId("input-add-person-name").fill("Pete");
  await box.getByTestId("input-add-person-email").fill("piotr.w@infomate.pl");
  await box.getByTestId("button-add-person-continue").click();
  await expectToast(page, "Piotr Wiśniewski is already in Second.");
  await expect(box.getByTestId("text-add-person-summary")).toHaveCount(0);
});
