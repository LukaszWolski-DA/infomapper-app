import { expect, test } from "./fixtures";
import { createOrganization, SEED_IDS } from "./helpers";

test("S8-04: signing in: the unknown e-mail, only the person's organizations, a wrong password, then the right one lands (AD-07)", async ({ page }) => {
  // an organization Łukasz has nothing to do with is never listed
  await createOrganization({ organization: "Elsewhere", name: "Ola", email: "ola@elsewhere.test" });
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill("nobody@example.com");
  await panel.getByTestId("button-sign-in-continue").click();
  await expect(panel.getByTestId("message-start")).toHaveText("No organization uses this e-mail address.");

  await panel.getByTestId("input-sign-in-email").fill(" Lukasz@InfoMate.pl ");
  await panel.getByTestId("button-sign-in-continue").click();
  const items = panel.getByTestId("button-sign-in-organization");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "InfoMate" })).toContainText(/\d+ workspaces?/);
  await expect(items.filter({ hasText: "Retail Co" })).toContainText("guest");
  await expect(panel).not.toContainText("Elsewhere");

  await items.filter({ hasText: "InfoMate" }).click();
  await panel.getByTestId("input-sign-in-password").fill("wrong-pass");
  await panel.getByTestId("button-sign-in").click();
  await expect(panel.getByTestId("message-start")).toHaveText("That password does not open InfoMate.");

  await panel.getByTestId("input-sign-in-password").fill("demo-pass");
  await panel.getByTestId("button-sign-in").click();
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(page.getByTestId("switcher-organization")).toContainText("InfoMate");
});

test("S8-04: a person with one organization skips the organization step", async ({ page }) => {
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill("m.lis@retailco.com");
  await panel.getByTestId("button-sign-in-continue").click();
  await expect(panel.getByTestId("text-sign-in-organization")).toHaveText("Retail Co");
  await panel.getByTestId("input-sign-in-password").fill("demo-pass");
  await panel.getByTestId("button-sign-in").click();
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));
});
