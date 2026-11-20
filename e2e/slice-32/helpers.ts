// Slice 32's helpers: the person's menu's Theme section, the root's tokens and colour scheme, the theme's cookie, and a
// page loaded without JavaScript (the first paint: what the server's HTML and CSS alone paint).

import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { SEED_IDS } from "../slice-00/helpers";

export * from "../slice-28/helpers";
export { signOutViaMenu } from "../slice-00/helpers";

export type ThemeChoice = "light" | "dark" | "system";

export const BANK = SEED_IDS.wsBankX;
export const CANVAS = `/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projCustomer360}/c/${SEED_IDS.canvasCustomerOrders}`;
export const OM_HOME = `/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projOrderManagement}`;

/** The palette's values (globals.css) the tests compare with: light, then dark. */
export const TOKENS = {
  "--im-surface": ["#ffffff", "#1f262f"],
  "--im-panel": ["#f6f7f9", "#181e25"],
  "--im-canvas": ["#e8ecf0", "#13181e"],
  "--im-map": ["#0b8a72", "#3ecfae"],
  "--im-physical": ["#a0660f", "#e2a74b"],
} as const;
export type Token = keyof typeof TOKENS;
export const BODY_BG = { light: "rgb(246, 247, 249)", dark: "rgb(24, 30, 37)" } as const;

export const userMenu = (page: Page): Locator => page.getByTestId("menu-user");
export const themeGroup = (page: Page): Locator => page.getByTestId("seg-theme");
export const themeItem = (page: Page, theme: ThemeChoice): Locator => page.getByTestId(`theme-${theme}`);

/**
 * Opens the person's menu (if it is not open). Asks the trigger, not the menu's visibility: after Escape the menu stays
 * visible for its closing animation, and a click on it then lands on an item that is leaving (step 4's full run).
 */
export async function openUserMenu(page: Page) {
  const trigger = page.getByTestId("indicator-user");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(userMenu(page)).toHaveAttribute("data-state", "open");
}

/** Chooses a theme in the menu; the menu stays open. */
export async function chooseTheme(page: Page, theme: ThemeChoice) {
  await openUserMenu(page);
  await themeItem(page, theme).click();
  await expectChecked(page, theme);
  await expect(userMenu(page)).toBeVisible();
}

/** The menu marks one choice: `aria-checked` on its radio item. */
export async function expectChecked(page: Page, theme: ThemeChoice) {
  for (const t of ["light", "dark", "system"] as const) await expect(themeItem(page, t)).toHaveAttribute("aria-checked", String(t === theme));
}

/** The attribute on `<html>`: null for System. */
export const themeAttr = (page: Page) => page.locator("html").getAttribute("data-theme");

/** A token as six-digit hex (the CSS build writes `#ffffff` as `#fff`). */
const sixDigits = (v: string) => (/^#[0-9a-f]{3}$/i.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v).toLowerCase();
export const tokenOf = async (page: Page, name: Token) => sixDigits(await page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name));
export const colorSchemeOf = (page: Page, selector = "html") => page.locator(selector).first().evaluate((e) => getComputedStyle(e).colorScheme);
export const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Every compared token shows its light or dark value. */
export async function expectTokens(page: Page, shade: "light" | "dark") {
  for (const [name, values] of Object.entries(TOKENS) as [Token, readonly [string, string]][]) {
    await expect.poll(() => tokenOf(page, name), { message: name }).toBe(values[shade === "light" ? 0 : 1]);
  }
}

export const themeCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === "im-theme");

/** The e2e data file's change events and its rows' count, to show that a choice writes nothing. */
export async function dataFootprint(): Promise<string> {
  const db = await readDb(E2E_DB);
  return JSON.stringify(Object.fromEntries(Object.entries(db).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
}

/**
 * A context with JavaScript off and the given context's cookies (the session and the theme): what the server's HTML and
 * CSS alone paint, before any script.
 */
export async function withoutScript(browser: Browser, from: BrowserContext, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme, viewport: { width: 1536, height: 864 } });
  await context.addCookies(await from.cookies());
  const page = await context.newPage();
  return { context, page };
}
