// S8-08 (slice 8, item 10), since slice 33 by invitations: "Invite person" replaced "Add person" (PT7). A new person joins
// by the link and sees only their workspace; an account keeps its name; someone already in or invited is refused.
import { createFromSwitcher } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { closeLinkDialog, expectToast, inviteInBox, joinByLink, openPeople, personRow, SEED_IDS, signInAs } from "./helpers";

const DWH = "Retail Co – DWH";

test("S8-08: inviting a new person: the link, Join with a name; they land signed in and see only their workspace", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const box = page.getByTestId("box-invite-person");
  await expect(box.getByTestId("select-invite-role")).toHaveValue("modeler");

  await box.getByTestId("button-create-invitation").click();
  await expect(box.getByTestId("message-field")).toHaveText("Enter an e-mail address.");

  const link = await inviteInBox(page, "  Ola@Example.com ", "reviewer");
  await expect(page.getByTestId("text-link-for")).toHaveText(`Send it to ola@example.com. They join ${DWH} as Reviewer.`);
  await closeLinkDialog(page);
  await expect(personRow(page, "ola@example.com")).toHaveCount(0);

  // the new person, in a browser of their own
  const context = await browser.newContext();
  const ola = await context.newPage();
  await ola.goto(link);
  await expect(ola.getByTestId("input-join-email")).toHaveValue("ola@example.com");
  await expect(ola.getByTestId("input-join-email")).toBeDisabled();
  await ola.getByTestId("button-join").click();
  await expect(ola.getByTestId("message-link")).toHaveText("Enter your name.");
  await joinByLink(ola, link, "Ola Nowa");
  await expect(ola).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(ola.getByTestId("indicator-user-role")).toHaveText("Reviewer");
  await ola.getByTestId("switcher-workspace").click();
  await expect(ola.getByTestId("menu-item-workspace")).toHaveCount(1);
  await expect(ola.getByTestId("menu-item-workspace")).toContainText(DWH);
  await ola.keyboard.press("Escape");
  expect((await ola.goto(`/w/${SEED_IDS.wsBankX}`))?.status()).toBe(404);
  await context.close();

  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(personRow(page, "Ola Nowa")).toContainText("ola@example.com");
  await expect(page.getByTestId("tab-people")).toHaveText("People (5)");
  await expect(page.getByTestId("table-pending")).toHaveCount(0);
});

test("S8-08: an account linked to this organization keeps its name, one from elsewhere joins with its own; someone already in or invited is refused", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  // a second InfoMate workspace without Piotr
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await createFromSwitcher(page, "switcher-workspace", "input-new-workspace", "Second");
  await expectToast(page, "Created the workspace Second.");
  await expect(page.getByTestId("switcher-workspace")).toHaveText("Second");
  const workspaceId = /\/w\/([^/?]+)/.exec(page.url())![1]!;
  await openPeople(page, workspaceId);

  // Piotr has a workspace in InfoMate: the link names his e-mail; joining keeps his name
  const piotrLink = await inviteInBox(page, "piotr.w@infomate.pl");
  await closeLinkDialog(page);
  // Marek is Retail Co's: InfoMate's page never shows his name before he joins
  const marekLink = await inviteInBox(page, "m.lis@retailco.com");
  await closeLinkDialog(page);
  await expect(page.getByTestId("row-pending")).toHaveCount(2);
  await expect(page.getByTestId("table-pending")).not.toContainText("Marek");

  // already invited, and (below) already in
  await page.getByTestId("input-invite-email").fill("piotr.w@infomate.pl");
  await page.getByTestId("button-create-invitation").click();
  await expect(page.getByTestId("box-invite-person").getByTestId("message-field")).toHaveText("piotr.w@infomate.pl is already in this workspace or invited.");

  for (const link of [piotrLink, marekLink]) {
    const context = await browser.newContext();
    await joinByLink(await context.newPage(), link);
    await context.close();
  }
  await openPeople(page, workspaceId);
  await expect(personRow(page, "Piotr Wiśniewski")).toBeVisible();
  await expect(personRow(page, "Marek Lis")).toBeVisible();
  await page.getByTestId("input-invite-email").fill("piotr.w@infomate.pl");
  await page.getByTestId("button-create-invitation").click();
  await expect(page.getByTestId("box-invite-person").getByTestId("message-field")).toHaveText("piotr.w@infomate.pl is already in this workspace or invited.");
});
