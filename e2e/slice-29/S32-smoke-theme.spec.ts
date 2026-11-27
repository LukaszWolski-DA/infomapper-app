// Slice 32's smoke on Postgres (P9): the theme on a production build with Supabase sign-in, as the preview serves it. A
// demo person chooses Dark under a light system; a reload paints dark from the server's HTML; the sign-in page keeps it
// after signing out; System restores the system's. The theme writes nothing, so this spec is safe against any target.

import { expect, test } from "@playwright/test";
import { PEOPLE, signIn } from "./helpers";

// the body is `im-surface` since slice 37 (white pages, Q9; it was `im-panel`)
const DARK_BODY = "rgb(31, 38, 47)";
const LIGHT_BODY = "rgb(255, 255, 255)";
const theme = (page: import("@playwright/test").Page) => page.locator("html").getAttribute("data-theme");
const body = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("S32 smoke: Dark chosen on Postgres, kept after a reload and on the sign-in page; System restores the system's", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, PEOPLE.marek);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  expect(await theme(page)).toBeNull();
  expect(await body(page)).toBe(LIGHT_BODY);

  await page.getByTestId("indicator-user").click();
  await page.getByTestId("theme-dark").click();
  await expect(page.getByTestId("theme-dark")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => body(page)).toBe(DARK_BODY);

  const html = await (await page.request.get(page.url())).text();
  expect(html).toMatch(/<html lang="en" data-theme="dark"/);
  await page.reload();
  expect(await theme(page)).toBe("dark");
  expect(await body(page)).toBe(DARK_BODY);

  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(await theme(page)).toBe("dark");
  expect(await body(page)).toBe(DARK_BODY);

  await signIn(page, PEOPLE.marek);
  await page.getByTestId("indicator-user").click();
  await page.getByTestId("theme-system").click();
  expect((await context.cookies()).find((c) => c.name === "im-theme")).toBeUndefined();
  await page.reload();
  expect(await theme(page)).toBeNull();
  expect(await body(page)).toBe(LIGHT_BODY);
});
