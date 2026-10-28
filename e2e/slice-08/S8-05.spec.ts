import { expect, test } from "./fixtures";
import { SEED_IDS } from "./helpers";

test("S8-05: an organization's link shows its name and asks for e-mail and password in one step; a non-member is refused", async ({ page }) => {
  await page.goto(`/sign-in?org=${SEED_IDS.orgRetailCo}`);
  const form = page.getByTestId("panel-organization-link");
  await expect(form.getByTestId("text-link-organization")).toHaveText("Retail Co");
  await expect(page.getByTestId("panel-create-organization")).toHaveCount(0);

  await form.getByTestId("input-sign-in-email").fill("anna.nowak@infomate.pl");
  await form.getByTestId("input-sign-in-password").fill("demo-pass");
  await form.getByTestId("button-sign-in").click();
  await expect(form.getByTestId("message-start")).toHaveText("No organization uses this e-mail address.");

  await form.getByTestId("input-sign-in-email").fill("m.lis@retailco.com");
  await form.getByTestId("button-sign-in").click();
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));
});
