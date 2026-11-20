// S32-02 (slice 32, D-85, criterion 2): the choice is remembered in a cookie per browser that the server reads. A reload
// paints the chosen theme from the first paint (the server's HTML carries the attribute and its CSS paints it with
// JavaScript off); the choice stays after signing out, on the sign-in page, in another workspace and in a new tab;
// another browser starts at System; a choice writes nothing in the data. P3: a page restored from the back-forward cache
// or another tab shown again takes the cookie's choice.

import { expect, test } from "./fixtures";
import {
  BANK,
  BODY_BG,
  CANVAS,
  bodyBg,
  chooseTheme,
  dataFootprint,
  expectChecked,
  expectTokens,
  openUserMenu,
  signInAs,
  signOutViaMenu,
  themeAttr,
  themeCookie,
  userMenu,
  withoutScript,
} from "./helpers";

test.use({ seed: "plain" });

test("S32-02: the cookie, and a reload dark from the first paint", async ({ page, browser, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  const footprint = await dataFootprint();
  await chooseTheme(page, "dark");

  const cookie = (await themeCookie(context))!;
  expect(cookie.value).toBe("dark");
  expect(cookie.path).toBe("/");
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.httpOnly).toBe(false);
  const days = (cookie.expires - Date.now() / 1000) / 86400;
  expect(days).toBeGreaterThan(364);
  expect(days).toBeLessThan(366);

  // the server's HTML carries the choice
  const html = await (await page.request.get(CANVAS)).text();
  expect(html).toMatch(/<html lang="en" data-theme="dark"/);

  // the first paint: no script runs, and the page is dark under a light system
  const bare = await withoutScript(browser, context, "light");
  await bare.page.goto(CANVAS);
  expect(await bare.page.locator("html").getAttribute("data-theme")).toBe("dark");
  expect(await bodyBg(bare.page)).toBe(BODY_BG.dark);
  await expectTokens(bare.page, "dark");
  await bare.context.close();

  await page.reload();
  expect(await themeAttr(page)).toBe("dark");
  await expectTokens(page, "dark");
  await openUserMenu(page);
  await expectChecked(page, "dark");

  // the choice writes nothing in the data
  expect(await dataFootprint()).toBe(footprint);

  // System deletes the cookie
  await chooseTheme(page, "system");
  expect(await themeCookie(context)).toBeUndefined();
  await page.reload();
  expect(await themeAttr(page)).toBeNull();
});

test("S32-02: kept after signing out, on the sign-in page, in another workspace and a new tab; another browser is at System", async ({ page, browser, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signInAs(page, "Łukasz");
  await chooseTheme(page, "light");
  await page.keyboard.press("Escape");
  await expect(userMenu(page)).toBeHidden();
  await signOutViaMenu(page);
  expect(await themeAttr(page)).toBe("light");
  await expectTokens(page, "light");
  expect(await themeCookie(context)).toMatchObject({ value: "light" });

  await signInAs(page, "Łukasz");
  await page.goto(`/w/${BANK}`);
  expect(await themeAttr(page)).toBe("light");
  await expectTokens(page, "light");

  const tab = await context.newPage();
  await tab.goto(CANVAS);
  expect(await themeAttr(tab)).toBe("light");
  await tab.close();

  // another browser (its own cookies) starts at System
  const other = await browser.newContext({ colorScheme: "dark" });
  const otherPage = await other.newPage();
  await signInAs(otherPage, "Łukasz");
  expect(await themeAttr(otherPage)).toBeNull();
  await expectTokens(otherPage, "dark");
  expect(await bodyBg(otherPage)).toBe(BODY_BG.dark);
  await other.close();
});

test("S32-02 (P3): another tab shown again, and a page restored from the back-forward cache, take the cookie's choice", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await other.goto(CANVAS);
  expect(await themeAttr(other)).toBeNull();

  await chooseTheme(page, "dark");
  // the other tab has not been shown since: it keeps its page as it was
  expect(await themeAttr(other)).toBeNull();
  // shown again
  await other.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => themeAttr(other)).toBe("dark");
  await expectTokens(other, "dark");

  // restored from the back-forward cache: its pageshow is "persisted"
  await chooseTheme(page, "light");
  await other.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect.poll(() => themeAttr(other)).toBe("light");
  // a plain pageshow (a new load) changes nothing by itself
  await chooseTheme(page, "system");
  await other.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false })));
  expect(await themeAttr(other)).toBe("light");
  await other.close();
});
