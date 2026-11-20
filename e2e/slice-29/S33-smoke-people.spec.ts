// Slice 33's Postgres side with Supabase Auth (S33-02 to S33-04 online): an invited new person's account, signing in
// after Join, an existing account joining, "Change password…", a reset link, the refused states, and an Admin's reset
// link for an Owner refused.
//
// F13 of slice 30: these specs write (Auth accounts too), so they run only against a database on this machine (CI's
// Supabase local stack, the Schema workflow's smoke job); against `npm run dev:pg` or the preview, both on
// infomapper-dev, they are skipped. They change only the passwords of the people they invite (made-up addresses, a new
// one each run), never a demo account's; never Łukasz's own model.
import { expect, test, type Page } from "@playwright/test";
import { fillSignIn, PEOPLE, query, signIn, workspaceId } from "./helpers";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const writesHere = (() => {
  const url = process.env.INFOMAPPER_DATABASE_URL;
  return !!url && LOCAL.includes(new URL(url).hostname);
})();
test.skip(!writesHere, "Writes only against a database on this machine (F13), never infomapper-dev.");

const WS = "Retail Co – DWH";
const GONE = "This invitation link has expired, was already used or was revoked. Nothing was changed.";
const RESET_GONE = "This password reset link has expired, was already used or was revoked. Nothing was changed.";
const REFUSED = "The e-mail address or the password is wrong.";

/** The id of the server action a UI step calls, and a direct call of it with the page's session (slice 0's helpers). */
async function captureActionId(page: Page, trigger: () => Promise<void>): Promise<string> {
  const request = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await trigger();
  return (await request).headers()["next-action"]!;
}
async function callActionDirectly(page: Page, actionId: string, args: unknown[]): Promise<string> {
  const response = await page.request.post("/", { headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, data: JSON.stringify(args) });
  return response.text();
}

async function invite(page: Page, wsId: string, email: string, role = "reviewer"): Promise<string> {
  await page.goto(`/w/${wsId}?tab=people`);
  const box = page.getByTestId("box-invite-person");
  await box.getByTestId("input-invite-email").fill(email);
  await box.getByTestId("select-invite-role").selectOption(role);
  await box.getByTestId("button-create-invitation").click();
  const link = await page.getByTestId("dialog-link").getByTestId("text-link").innerText();
  await page.getByTestId("button-link-done").click();
  return link;
}

/** Signs out from an app page (a link's page has no person's menu: back to the start, which lands in a workspace). */
async function signOut(page: Page) {
  if (!(await page.getByTestId("indicator-user").isVisible())) await page.goto("/");
  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in/);
}

const stamp = Date.now();
const NEWCOMER = `smoke.join.${stamp}@example.com`;
const FIRST = `first-pass-${stamp}`;
const SECOND = `second-pass-${stamp}`;
const THIRD = `third-pass-${stamp}`;

test.describe.configure({ mode: "serial" });

test("S33-02 online: a new person joins with a password, lands signed in, and signs in again with it", async ({ page, browser }) => {
  await signIn(page, PEOPLE.lukasz);
  const ws = await workspaceId(WS);
  const link = await invite(page, ws, NEWCOMER);

  const context = await browser.newContext();
  const them = await context.newPage();
  await them.goto(link);
  await expect(them.getByTestId("form-join")).toHaveAttribute("data-kind", "new");
  await them.getByTestId("input-join-name").fill("Smoke Newcomer");
  await them.getByTestId("input-join-password").fill("short");
  await them.getByTestId("input-join-password-again").fill("short");
  await them.getByTestId("button-join").click();
  await expect(them.getByTestId("message-link")).toHaveText("The password needs at least 10 characters.");
  await them.getByTestId("input-join-password").fill(FIRST);
  await them.getByTestId("input-join-password-again").fill(`${FIRST}x`);
  await them.getByTestId("button-join").click();
  await expect(them.getByTestId("message-link")).toHaveText("The two passwords are not the same.");
  await them.getByTestId("input-join-password-again").fill(FIRST);
  await them.getByTestId("button-join").click();
  await expect(them).toHaveURL(new RegExp(`/w/${ws}$`));
  await expect(them.getByTestId("indicator-user-role")).toHaveText("Reviewer");
  // the account is linked to its person
  const [row] = await query<{ linked: boolean }>("select auth_user_id is not null as linked from app_user where email = $1", [NEWCOMER]);
  expect(row?.linked).toBe(true);
  // the link once more: the one message
  await them.goto(link);
  await expect(them.getByTestId("text-link-gone")).toContainText(GONE);

  await signOut(them);
  await fillSignIn(them, NEWCOMER, FIRST);
  await expect(them).toHaveURL(new RegExp(`/w/${ws}`));
  await context.close();
});

test("S33-03 online: Change password… — a wrong current password changes nothing; then the new one works and the old does not", async ({ browser }) => {
  const context = await browser.newContext();
  const them = await context.newPage();
  await fillSignIn(them, NEWCOMER, FIRST);
  await expect(them).not.toHaveURL(/\/sign-in/);
  await them.getByTestId("indicator-user").click();
  await them.getByTestId("button-change-password").click();
  const dialog = them.getByTestId("dialog-change-password");
  await expect(dialog).toContainText(`For ${NEWCOMER}.`);
  await dialog.getByTestId("input-current-password").fill("not-the-password");
  await dialog.getByTestId("input-new-password").fill(SECOND);
  await dialog.getByTestId("input-new-password-again").fill(SECOND);
  await dialog.getByTestId("button-change-own-password").click();
  await expect(dialog.getByTestId("message-change-password")).toHaveText("The current password is not right. Nothing was changed.");
  await dialog.getByTestId("input-current-password").fill(FIRST);
  await dialog.getByTestId("button-change-own-password").click();
  await expect(them.getByTestId("toast").filter({ hasText: "Password changed. Use the new one next time you sign in." })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await signOut(them);
  await fillSignIn(them, NEWCOMER, FIRST);
  await expect(them.getByTestId("message-start")).toHaveText(REFUSED);
  await fillSignIn(them, NEWCOMER, SECOND);
  await expect(them).not.toHaveURL(/\/sign-in/);
  await context.close();
});

test("S33-03 online: a reset link from an Owner; the person sets a new password and is signed in; the link works once", async ({ page, browser }) => {
  await signIn(page, PEOPLE.lukasz);
  const ws = await workspaceId(WS);
  await page.goto(`/w/${ws}?tab=people`);
  const row = page.getByTestId("row-person").filter({ hasText: NEWCOMER });
  const resetAction = await captureActionId(page, () => row.getByTestId("button-reset-link").click());
  const dialog = page.getByTestId("dialog-link");
  await expect(dialog.getByRole("heading")).toHaveText("Password reset link");
  await expect(dialog.getByTestId("text-link-for")).toHaveText("For Smoke Newcomer. They set a new password with it and are signed in.");
  await expect(dialog.getByTestId("text-link-valid")).toContainText("It works once, for 24 hours.");
  const link = await dialog.getByTestId("text-link").innerText();
  await page.getByTestId("button-link-done").click();
  // not for oneself, nor (as an Owner here) is the button shown for the guest Kasia
  await expect(page.getByTestId("row-person").filter({ hasText: PEOPLE.lukasz }).getByTestId("button-reset-link")).toHaveCount(0);
  await expect(page.getByTestId("row-person").filter({ hasText: PEOPLE.kasia }).getByTestId("button-reset-link")).toHaveCount(0);

  const context = await browser.newContext();
  const them = await context.newPage();
  await them.goto(link);
  await expect(them.getByTestId("text-reset-for")).toHaveText(`For ${NEWCOMER}. This link works once, for 24 hours.`);
  await them.getByTestId("input-reset-password").fill(THIRD);
  await them.getByTestId("input-reset-password-again").fill(THIRD);
  await them.getByTestId("button-set-password").click();
  await expect(them).not.toHaveURL(/\/(reset|sign-in)/);
  await expect(them.getByTestId("bar-top")).toBeVisible();
  await them.goto(link);
  await expect(them.getByTestId("text-link-gone")).toContainText(RESET_GONE);
  await signOut(them);
  await fillSignIn(them, NEWCOMER, THIRD);
  await expect(them).not.toHaveURL(/\/sign-in/);
  await context.close();

  // an Admin never for an Owner (D1): Anna made Admin here for the check, then Modeler again
  const [lukasz] = await query<{ id: string }>("select id from app_user where email = $1", [PEOPLE.lukasz]);
  const [anna] = await query<{ id: string }>("select id from app_user where email = $1", [PEOPLE.anna]);
  await query("update workspace_member set role = 'admin' where workspace_id = $1 and user_id = $2", [ws, anna!.id]);
  try {
    const context2 = await browser.newContext();
    const admin = await context2.newPage();
    await signIn(admin, PEOPLE.anna);
    await admin.goto(`/w/${ws}?tab=people`);
    await expect(admin.getByTestId("box-invite-person")).toBeVisible();
    await expect(admin.getByTestId("row-person").filter({ hasText: PEOPLE.lukasz }).getByTestId("button-reset-link")).toHaveCount(0);
    expect(await callActionDirectly(admin, resetAction, [{ workspaceId: ws, userId: lukasz!.id }])).toContain("Only an owner can make a password reset link for an owner.");
    await context2.close();
  } finally {
    await query("update workspace_member set role = 'modeler' where workspace_id = $1 and user_id = $2", [ws, anna!.id]);
  }
});

test("S33-02 online: an existing account signs in and joins another workspace; a wrong password changes nothing", async ({ page, browser }) => {
  await signIn(page, PEOPLE.lukasz);
  const ws = await workspaceId(WS);
  // a second workspace of InfoMate, made from the switcher
  await page.goto(`/w/${ws}`);
  const name = `Smoke second ${stamp}`;
  await page.getByTestId("switcher-workspace").click();
  await page.getByTestId("input-new-workspace").fill(name);
  await page.getByTestId("input-new-workspace").press("Enter");
  await expect(page.getByTestId("switcher-workspace")).toHaveText(name);
  const second = await workspaceId(name);
  const link = await invite(page, second, NEWCOMER, "reader");

  const context = await browser.newContext();
  const them = await context.newPage();
  await them.goto(link);
  await expect(them.getByTestId("form-join")).toHaveAttribute("data-kind", "existing");
  await expect(them.getByTestId("button-join")).toHaveText("Sign in and join");
  await them.getByTestId("input-join-password").fill("not-the-password");
  await them.getByTestId("button-join").click();
  await expect(them.getByTestId("message-link")).toHaveText(REFUSED);
  const [before] = await query<{ n: number }>("select count(*)::int as n from workspace_member where workspace_id = $1", [second]);
  expect(before!.n).toBe(1);
  await them.getByTestId("input-join-password").fill(THIRD);
  await them.getByTestId("button-join").click();
  await expect(them).toHaveURL(new RegExp(`/w/${second}$`));
  await expect(them.getByTestId("indicator-user-role")).toHaveText("Reader");
  await them.getByTestId("switcher-workspace").click();
  await expect(them.getByTestId("menu-item-workspace")).toHaveCount(2);
  await context.close();
});
