import { expect, test } from "./fixtures";
import { expectToast, openPeople, SEED_IDS, signInWithPassword, signOutViaMenu } from "./helpers";

test("S8-11: Copy puts the organization's link on the clipboard; after a password change the old one is refused, the new one works, a signed-in session stays", async ({ page, browser, baseURL }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  // Anna signs in with InfoMate's password before the change
  const anna = await browser.newContext();
  const annaPage = await anna.newPage();
  await signInWithPassword(annaPage, "anna.nowak@infomate.pl");

  await signInWithPassword(page, "lukasz@infomate.pl", "InfoMate");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const box = page.getByTestId("box-organization-access");
  const link = `${baseURL}/sign-in?org=${SEED_IDS.orgInfoMate}`;
  await expect(box.getByTestId("text-organization-link")).toHaveText(link);
  await box.getByTestId("button-copy-link").click();
  await expectToast(page, "Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

  await box.getByTestId("input-new-password").fill("short");
  await box.getByTestId("button-password-continue").click();
  await expect(box.getByTestId("message-field")).toHaveText("The password needs at least 8 characters.");
  await box.getByTestId("input-new-password").fill("new-pass-1");
  await box.getByTestId("input-new-password-again").fill("new-pass-1");
  await box.getByTestId("button-password-continue").click();
  await expect(box.getByTestId("text-password-summary")).toHaveText("People who are signed in stay signed in; the next sign-in needs the new password.");
  await box.getByTestId("button-change-password").click();
  await expectToast(page, "Changed the password of InfoMate.");
  await expect(box.getByTestId("input-new-password")).toHaveValue("");

  // Anna's session stays
  await annaPage.reload();
  await expect(annaPage.getByTestId("bar-top")).toBeVisible();
  await expect(annaPage.getByTestId("switcher-organization")).toContainText("InfoMate");
  await anna.close();

  // the next sign-in: the old password is refused, the new one works
  await signOutViaMenu(page);
  await page.goto(link);
  const form = page.getByTestId("panel-organization-link");
  await form.getByTestId("input-sign-in-email").fill("lukasz@infomate.pl");
  await form.getByTestId("input-sign-in-password").fill("demo-pass");
  await form.getByTestId("button-sign-in").click();
  await expect(form.getByTestId("message-start")).toHaveText("That password does not open InfoMate.");
  await form.getByTestId("input-sign-in-password").fill("new-pass-1");
  await form.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
});
