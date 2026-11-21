// fix/blank-page-after-sign-in (docs/prd/fix-blank-page-after-sign-in.md, D1 (a)): after an action that changes the
// session, the form leaves its page by a full page load, never by the router (`router.push` raced the action's own
// refresh: a discarded action, a queued refresh, the landing asked for twice). Here the local adapter's three: the sign-in
// step by step, an organization's link and Join. The Postgres side (the account form, Join, Set password) is
// `e2e/slice-29/fix-smoke-session-full-load.spec.ts`.
import { expect, test } from "../slice-08/fixtures";
import { DEMO_PASSWORD, inviteAs, SEED_IDS } from "../slice-08/helpers";
import { watchSessionChange } from "../session-full-load";

test("sign-in step by step lands by a full page load", async ({ page }) => {
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill("m.lis@retailco.com");
  await panel.getByTestId("button-sign-in-continue").click();
  await panel.getByTestId("input-sign-in-password").fill(DEMO_PASSWORD);
  const watch = await watchSessionChange(page);
  await panel.getByTestId("button-sign-in").click();
  await watch.expectFullLoad(new RegExp(`/w/${SEED_IDS.wsSales}$`));
});

test("an organization's link lands by a full page load", async ({ page }) => {
  await page.goto(`/sign-in?org=${SEED_IDS.orgRetailCo}`);
  const form = page.getByTestId("panel-organization-link");
  await form.getByTestId("input-sign-in-email").fill("m.lis@retailco.com");
  await form.getByTestId("input-sign-in-password").fill(DEMO_PASSWORD);
  const watch = await watchSessionChange(page);
  await form.getByTestId("button-sign-in").click();
  await watch.expectFullLoad(new RegExp(`/w/${SEED_IDS.wsSales}$`));
});

test("Join lands by a full page load", async ({ page }) => {
  const { token } = await inviteAs(SEED_IDS.userLukasz, SEED_IDS.wsRetailDwh, "full.load@example.com", "reviewer");
  await page.goto(`/invite/${token}`);
  await expect(page.getByTestId("form-join")).toBeVisible();
  await page.getByTestId("input-join-name").fill("Full Load");
  const watch = await watchSessionChange(page);
  await page.getByTestId("button-join").click();
  await watch.expectFullLoad(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
});
