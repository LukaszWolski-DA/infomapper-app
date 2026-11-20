// S33-04 (criterion 4), its local part: a guessed or altered address gives no access; the pages are reached without a
// session (the proxy lets `/invite/…` and `/reset/…` through) and nothing else is; an invited person sees only the
// workspace they were invited to, not the organization's other workspaces.
import { expect, test } from "./fixtures";
import { altered, closeLinkDialog, expectGone, inviteInBox, joinByLink, openPeople, SEED_IDS, signInAs, stored } from "./helpers";

test("S33-04: an altered, a cut and a guessed link give the one message without a session; the app's pages still ask to sign in", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  const link = await inviteInBox(page, "only.this@example.com");
  await closeLinkDialog(page);

  const context = await browser.newContext();
  const stranger = await context.newPage();
  for (const tried of [altered(link), link.slice(0, -5), `${new URL(link).origin}/invite/${"x".repeat(43)}`, `${new URL(link).origin}/invite/not-a-token`]) {
    await expectGone(stranger, tried);
  }
  // no session: the link's page opens, a workspace's page does not
  await stranger.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await expect(stranger).toHaveURL(/\/sign-in/);
  expect((await stored()).invitation.every((i) => i.accepted_at === null)).toBe(true);

  // the real link: only the workspace it was made for
  await joinByLink(stranger, link, "Only This");
  await stranger.getByTestId("switcher-workspace").click();
  await expect(stranger.getByTestId("menu-item-workspace")).toHaveCount(1);
  await stranger.keyboard.press("Escape");
  expect((await stranger.goto(`/w/${SEED_IDS.wsBankX}`))?.status()).toBe(404);
  expect((await stranger.goto(`/w/${SEED_IDS.wsSales}`))?.status()).toBe(404);
  await context.close();
});
