// fix/blank-page-after-sign-in (docs/prd/fix-blank-page-after-sign-in.md, D1 (a)) on Postgres with Supabase Auth: after
// the account form, Join and Set password the page is a new document, and the landing (`/`, which redirects to the
// workspace, for the sign-in and Set password) is asked for once. The local adapter's forms are
// `e2e/fixes/session-change-full-load.spec.ts`.
//
// The sign-in writes nothing and runs against any target. Join and Set password write Auth accounts, so (F13 of slice
// 30) they run only against a database on this machine (CI's Supabase local stack), as `S33-smoke-people` does: a
// made-up address of their own each run, never a demo account's password.
import { expect, test } from "@playwright/test";
import { watchSessionChange } from "../session-full-load";
import { demoPassword, PEOPLE, signIn, workspaceId } from "./helpers";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const writesHere = (() => {
  const url = process.env.INFOMAPPER_DATABASE_URL;
  return !!url && LOCAL.includes(new URL(url).hostname);
})();

const WORKSPACE = /\/w\/[^/?#]+$/;

test("the account form lands by a full page load", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByTestId("panel-account-sign-in")).toBeVisible();
  await page.getByTestId("input-sign-in-email").fill(PEOPLE.marek);
  await page.getByTestId("input-sign-in-password").fill(demoPassword());
  const watch = await watchSessionChange(page);
  await page.getByTestId("button-sign-in").click();
  await watch.expectFullLoad(WORKSPACE);
});

test.describe("writes", () => {
  test.skip(!writesHere, "Writes only against a database on this machine (F13), never infomapper-dev.");
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const EMAIL = `smoke.full.load.${stamp}@example.com`;
  const FIRST = `full-load-first-${stamp}`;
  const SECOND = `full-load-second-${stamp}`;
  const WS = "Retail Co – DWH";

  test("Join lands by a full page load", async ({ page, browser }) => {
    await signIn(page, PEOPLE.lukasz);
    const ws = await workspaceId(WS);
    await page.goto(`/w/${ws}?tab=people`);
    const box = page.getByTestId("box-invite-person");
    await box.getByTestId("input-invite-email").fill(EMAIL);
    await box.getByTestId("select-invite-role").selectOption("reviewer");
    await box.getByTestId("button-create-invitation").click();
    const link = await page.getByTestId("dialog-link").getByTestId("text-link").innerText();
    await page.getByTestId("button-link-done").click();

    const context = await browser.newContext();
    const them = await context.newPage();
    await them.goto(link);
    await expect(them.getByTestId("form-join")).toHaveAttribute("data-kind", "new");
    await them.getByTestId("input-join-name").fill("Smoke Full Load");
    await them.getByTestId("input-join-password").fill(FIRST);
    await them.getByTestId("input-join-password-again").fill(FIRST);
    const watch = await watchSessionChange(them);
    await them.getByTestId("button-join").click();
    await watch.expectFullLoad(new RegExp(`/w/${ws}$`));
    await context.close();
  });

  test("Set password lands by a full page load", async ({ page, browser }) => {
    await signIn(page, PEOPLE.lukasz);
    const ws = await workspaceId(WS);
    await page.goto(`/w/${ws}?tab=people`);
    await page.getByTestId("row-person").filter({ hasText: EMAIL }).getByTestId("button-reset-link").click();
    const link = await page.getByTestId("dialog-link").getByTestId("text-link").innerText();
    await page.getByTestId("button-link-done").click();

    const context = await browser.newContext();
    const them = await context.newPage();
    await them.goto(link);
    await them.getByTestId("input-reset-password").fill(SECOND);
    await them.getByTestId("input-reset-password-again").fill(SECOND);
    const watch = await watchSessionChange(them);
    await them.getByTestId("button-set-password").click();
    await watch.expectFullLoad(WORKSPACE);
    await context.close();
  });
});
