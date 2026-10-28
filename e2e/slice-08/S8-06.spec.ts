import { callActionDirectly, captureActionId, createFromSwitcher } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { addPerson, createOrganization, SEED_IDS, signInWithPassword, signOutViaMenu } from "./helpers";

test("S8-06: silos: another organization asks for its password once and returns to the page; not a member is a 404; sign out ends both", async ({ page }) => {
  await signInWithPassword(page, "lukasz@infomate.pl", "InfoMate");

  // Sales analytics is Retail Co's, not unlocked yet: its page asks for Retail Co's password, e-mail filled in
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(page).toHaveURL(/\/sign-in\?org=/);
  const form = page.getByTestId("panel-organization-link");
  await expect(form.getByTestId("text-link-organization")).toHaveText("Retail Co");
  await expect(form.getByTestId("input-sign-in-email")).toHaveValue("lukasz@infomate.pl");
  await form.getByTestId("input-sign-in-password").fill("demo-pass");
  await form.getByTestId("button-sign-in").click();
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));

  // now both switch without asking
  await page.getByTestId("switcher-organization").click();
  await expect(page.getByTestId("icon-locked")).toHaveCount(0);
  await page.getByTestId("menu-item-organization").filter({ hasText: "InfoMate" }).click();
  await expect(page.getByTestId("switcher-organization")).toContainText("InfoMate");

  // an organization he is not in: its workspace does not exist for him
  const elsewhere = await createOrganization({ organization: "Elsewhere", name: "Ola", email: "ola@elsewhere.test" });
  expect((await page.goto(`/w/${elsewhere.workspaceId}`))?.status()).toBe(404);

  await page.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await signOutViaMenu(page);
  for (const ws of [SEED_IDS.wsRetailDwh, SEED_IDS.wsSales]) {
    await page.goto(`/w/${ws}`);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("S8-06: P4: Retail Co's owner adds InfoMate's Anna, signs in as her with Retail Co's password, and InfoMate still asks for its own", async ({ page }) => {
  await addPerson(SEED_IDS.userMarek, SEED_IDS.wsSales, { name: "Anna", email: "anna.nowak@infomate.pl", role: "modeler" });
  await signInWithPassword(page, "anna.nowak@infomate.pl", "Retail Co");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));

  await page.getByTestId("switcher-organization").click();
  const infomate = page.getByTestId("menu-item-organization").filter({ hasText: "InfoMate" });
  await expect(infomate.getByTestId("icon-locked")).toHaveAttribute("title", "Asks for the password once");
  await infomate.click();
  await expect(page).toHaveURL(/\/sign-in\?org=/);
  await expect(page.getByTestId("text-link-organization")).toHaveText("InfoMate");

  // the server refuses a write into InfoMate too, whatever the page shows
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  const createProject = await captureActionId(page, () => createFromSwitcher(page, "switcher-project", "input-new-project", "Mine"));
  expect(await callActionDirectly(page, createProject, [{ workspaceId: SEED_IDS.wsRetailDwh, name: "Sneaky" }])).toContain(
    "Unlock InfoMate first: open it and enter its password.",
  );
});
