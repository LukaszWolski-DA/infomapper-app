// S29-05 (slice 29): sign-in on Postgres. A demo person signs in with their password, sees only their organizations'
// workspaces (the silo rule), signs out; a wrong password is refused; there is no sign-up and no development sign-in.
import { expect, test } from "@playwright/test";
import { ACCOUNT_SIGN_IN_REFUSED } from "../../src/app/_lib/account-texts";
import { fillSignIn, PEOPLE, signIn, workspaceId } from "./helpers";

test("the start page is the account form alone: no test users, no new organization", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByTestId("panel-account-sign-in")).toBeVisible();
  await expect(page.getByTestId("list-dev-users")).toHaveCount(0);
  await expect(page.getByTestId("banner-dev-sign-in")).toHaveCount(0);
  await expect(page.getByText("Create an organization")).toHaveCount(0);
});

test("without a session a page redirects to the start page", async ({ page }) => {
  const ws = await workspaceId("Sales analytics");
  await page.goto(`/w/${ws}`);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a wrong password is refused and the page stays the start page", async ({ page }) => {
  await fillSignIn(page, PEOPLE.marek, `wrong-${Date.now()}`);
  await expect(page.getByTestId("message-start")).toHaveText(ACCOUNT_SIGN_IN_REFUSED);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("an unknown e-mail address is refused with the same words", async ({ page }) => {
  await fillSignIn(page, "nobody@retailco.com");
  await expect(page.getByTestId("message-start")).toHaveText(ACCOUNT_SIGN_IN_REFUSED);
});

test("Marek sees only Retail Co's workspace; InfoMate's are not there for him", async ({ page }) => {
  await signIn(page, PEOPLE.marek);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await page.getByTestId("switcher-organization").click();
  await expect(page.getByTestId("menu-item-organization")).toHaveText([/Retail Co/]);
  await page.keyboard.press("Escape");
  await page.getByTestId("switcher-workspace").click();
  await expect(page.getByTestId("menu-item-workspace")).toHaveText([/Sales analytics/]);
  await page.keyboard.press("Escape");
  const other = await workspaceId("Retail Co – DWH");
  const answer = await page.goto(`/w/${other}`);
  expect(answer?.status()).toBe(404);
});

test("Kasia, a guest in one InfoMate workspace, opens it and no other of InfoMate's", async ({ page }) => {
  await signIn(page, PEOPLE.kasia);
  const guest = await workspaceId("Retail Co – DWH");
  await page.goto(`/w/${guest}`);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  const notHers = await workspaceId("Performance test");
  expect((await page.goto(`/w/${notHers}`))?.status()).toBe(404);
});

test("Łukasz sees both organizations; signing out ends the session", async ({ page }) => {
  await signIn(page, PEOPLE.lukasz);
  await page.getByTestId("switcher-organization").click();
  await expect(page.getByTestId("menu-item-organization")).toHaveText([/InfoMate/, /Retail Co/]);
  await expect(page.getByTestId("menu-item-new-organization")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const here = page.url();
  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto(here);
  await expect(page).toHaveURL(/\/sign-in/);
});
