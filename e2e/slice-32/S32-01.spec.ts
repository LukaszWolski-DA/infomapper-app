// S32-01 (slice 32, D-85, criterion 1): the person's menu has a section "Theme" with Light, Dark and System in one row;
// System is chosen by default and follows the system both ways; Dark and Light change the whole page at once, without a
// reload, against the system (the canvas, the side panels and the menu); the menu stays open after a choice; the
// choices are radio items the menu's keyboard reaches (P2).

import { expect, test } from "./fixtures";
import { BODY_BG, CANVAS, bodyBg, chooseTheme, expectChecked, expectTokens, openUserMenu, signInAs, themeAttr, themeGroup, themeItem, userMenu } from "./helpers";

test.use({ seed: "plain" });

const canvasBg = (page: import("@playwright/test").Page) => page.locator(".im-canvas").first().evaluate((e) => getComputedStyle(e).backgroundColor);
const panelBg = (page: import("@playwright/test").Page) => page.getByTestId("panel-inspector").evaluate((e) => getComputedStyle(e).backgroundColor);
const menuBg = (page: import("@playwright/test").Page) => userMenu(page).evaluate((e) => getComputedStyle(e).backgroundColor);

test("S32-01: the section, System by default, as the prototype: one row between Workspace home and Sign out", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  await openUserMenu(page);
  const menu = userMenu(page);
  await expect(menu.getByText("Theme", { exact: true })).toBeVisible();
  await expect(themeGroup(page)).toHaveAccessibleName("Theme");
  await expect(themeGroup(page).getByRole("menuitemradio")).toHaveText(["Light", "Dark", "System"]);
  await expectChecked(page, "system");
  expect(await themeAttr(page)).toBeNull();
  // between "Workspace home" and "Sign out", in one row
  const order = await menu.evaluate((m) => [...m.querySelectorAll("a, [data-testid]")].map((e) => e.getAttribute("data-testid") ?? e.textContent?.trim()));
  expect(order.indexOf("Workspace home")).toBeLessThan(order.indexOf("seg-theme"));
  expect(order.indexOf("seg-theme")).toBeLessThan(order.indexOf("button-sign-out"));
  const tops = await themeGroup(page).getByRole("menuitemradio").evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

/** The open menu with a margin of the page around it, attached to the report (the step's screenshots, demo data only). */
async function attachMenu(page: import("@playwright/test").Page, name: string) {
  const box = (await userMenu(page).boundingBox())!;
  const clip = { x: box.x - 240, y: 0, width: box.width + 260, height: box.y + box.height + 24 };
  await test.info().attach(name, { body: await page.screenshot({ clip }), contentType: "image/png" });
}

test("S32-01: Dark under a light system and Light under a dark one, at once, the menu kept open", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  await expect(page.locator(".im-canvas")).toBeVisible();
  await expectTokens(page, "light");
  const before = { canvas: await canvasBg(page), panel: await panelBg(page) };

  let loads = 0;
  page.on("load", () => loads++);
  await chooseTheme(page, "dark");
  expect(await themeAttr(page)).toBe("dark");
  await expectTokens(page, "dark");
  expect(await bodyBg(page)).toBe(BODY_BG.dark);
  expect(await canvasBg(page)).not.toBe(before.canvas);
  expect(await panelBg(page)).not.toBe(before.panel);
  expect(await menuBg(page)).toBe("rgb(31, 38, 47)");
  await attachMenu(page, "menu-dark");
  await expect(userMenu(page)).toBeVisible();

  await page.emulateMedia({ colorScheme: "dark" });
  await chooseTheme(page, "light");
  expect(await themeAttr(page)).toBe("light");
  await expectTokens(page, "light");
  expect(await bodyBg(page)).toBe(BODY_BG.light);
  expect(await canvasBg(page)).toBe(before.canvas);
  expect(await panelBg(page)).toBe(before.panel);
  expect(await menuBg(page)).toBe("rgb(255, 255, 255)");
  await page.mouse.move(0, 400);
  await attachMenu(page, "menu-light");
  expect(loads).toBe(0);

  // Escape closes the menu as before
  await page.keyboard.press("Escape");
  await expect(userMenu(page)).toBeHidden();
});

test("S32-01: System follows the system both ways", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  await chooseTheme(page, "dark");
  await chooseTheme(page, "system");
  expect(await themeAttr(page)).toBeNull();
  await expectTokens(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTokens(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTokens(page, "dark");
});

test("S32-01: the keyboard reaches the choices; Enter chooses and the menu stays open", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, "Łukasz");
  await page.goto(CANVAS);
  await openUserMenu(page);
  await themeItem(page, "light").focus();
  await page.keyboard.press("ArrowDown");
  await expect(themeItem(page, "dark")).toBeFocused();
  await page.keyboard.press("Enter");
  await expectChecked(page, "dark");
  expect(await themeAttr(page)).toBe("dark");
  await page.keyboard.press("ArrowDown");
  await expect(themeItem(page, "system")).toBeFocused();
  await page.keyboard.press(" ");
  await expectChecked(page, "system");
  expect(await themeAttr(page)).toBeNull();
  await expect(userMenu(page)).toBeVisible();
});
