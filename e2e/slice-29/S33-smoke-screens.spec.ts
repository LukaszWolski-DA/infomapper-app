// Slice 33's online screenshots (demo data only): the People tab with "Password reset link" and a pending invitation,
// the link dialog, the invite page, "Change password…". Taken in CI's smoke job on Supabase's throwaway local stack
// (the artifact `smoke-screens`); against `dev:pg` or the preview it is skipped (it writes: an invitation); never his own model.
import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { PEOPLE, signIn, workspaceId } from "./helpers";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const writesHere = (() => {
  const url = process.env.INFOMAPPER_DATABASE_URL;
  return !!url && LOCAL.includes(new URL(url).hostname);
})();
test.skip(!writesHere, "Writes only against a database on this machine (F13), never infomapper-dev.");

const folder = path.resolve("test-results/screens-pg");

test("slice 33 screens (online)", async ({ page, browser }) => {
  fs.mkdirSync(folder, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PEOPLE.lukasz);
  const ws = await workspaceId("Retail Co – DWH");
  await page.goto(`/w/${ws}?tab=people`);
  const box = page.getByTestId("box-invite-person");
  await box.getByTestId("input-invite-email").fill(`jan.kowalski.${Date.now()}@example.com`);
  await box.getByTestId("select-invite-role").selectOption("reviewer");
  await box.getByTestId("button-create-invitation").click();
  const dialog = page.getByTestId("dialog-link");
  await dialog.waitFor();
  const link = await dialog.getByTestId("text-link").innerText();
  await page.screenshot({ path: path.join(folder, "online-link-dialog.png") });
  await page.getByTestId("button-link-done").click();
  await page.screenshot({ path: path.join(folder, "online-people-tab.png"), fullPage: true });

  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-change-password").click();
  await page.getByTestId("dialog-change-password").waitFor();
  await page.screenshot({ path: path.join(folder, "online-change-password.png") });
  await page.keyboard.press("Escape");

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const them = await context.newPage();
  await them.goto(link);
  await them.getByTestId("form-join").waitFor();
  await them.screenshot({ path: path.join(folder, "online-invite-page.png") });
  await context.close();
});
