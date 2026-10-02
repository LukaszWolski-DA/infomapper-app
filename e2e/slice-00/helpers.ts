import { expect, type Page } from "@playwright/test";
import { SEED_IDS } from "../../src/data/local/seed";

export { SEED_IDS };

export type SeedUserName = "Łukasz" | "Anna Nowak" | "Piotr Wiśniewski" | "Kasia Zielińska" | "Marek Lis";

export async function signInAs(page: Page, name: SeedUserName) {
  await page.goto("/sign-in");
  await page.getByTestId("button-dev-user").filter({ hasText: name }).click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
}

export async function pickFromMenu(page: Page, switcher: string, item: string) {
  await page.getByTestId(switcher).click();
  await page.getByRole("menuitem", { name: item }).click();
}

export async function signOutViaMenu(page: Page) {
  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
