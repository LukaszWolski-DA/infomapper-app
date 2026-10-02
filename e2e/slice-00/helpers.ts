import { expect, type Browser, type Page } from "@playwright/test";
import { SEED_IDS } from "../../src/data/local/seed";
import { createLocalDataStore } from "../../src/data/local/store";
import { buildWriteSet } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceRole } from "../../src/domain/types";
import { E2E_DB } from "../config";

export { SEED_IDS };

export type SeedUserName = "Łukasz" | "Anna Nowak" | "Piotr Wiśniewski" | "Kasia Zielińska" | "Marek Lis";

export async function signInAs(page: Page, name: SeedUserName) {
  await page.goto("/sign-in");
  await page.getByTestId("button-dev-user").filter({ hasText: name }).click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
}

/** A separate browser session (its own cookies), signed in as the given user. */
export async function newSession(browser: Browser, name: SeedUserName) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, name);
  return { context, page };
}

export async function pickFromMenu(page: Page, switcher: string, item: string | RegExp) {
  await page.getByTestId(switcher).click();
  await page.getByRole("menuitem", { name: item }).click();
}

export async function signOutViaMenu(page: Page) {
  await page.getByTestId("indicator-user").click();
  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

export async function expectToast(page: Page, message: string | RegExp) {
  const toast = page.getByTestId("toast");
  await expect(toast).toHaveAttribute("data-visible", "true");
  await expect(toast).toHaveText(message);
}

/** Types a name into a switcher's "…, then Enter" field. */
export async function createFromSwitcher(page: Page, switcher: string, input: string, name: string) {
  await page.getByTestId(switcher).click();
  await page.getByTestId(input).fill(name);
  await page.getByTestId(input).press("Enter");
}

/** The id of the server action a UI step calls (captured from its request), to call it again directly. */
export async function captureActionId(page: Page, trigger: () => Promise<void>): Promise<string> {
  const request = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await trigger();
  return (await request).headers()["next-action"]!;
}

/** Calls a server action directly, bypassing the UI, with the page's session. Returns the raw response text. */
export async function callActionDirectly(page: Page, actionId: string, args: unknown[]): Promise<string> {
  const response = await page.request.post("/", {
    headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" },
    data: JSON.stringify(args),
  });
  return response.text();
}

/** Test setup only: adds a workspace member through the data adapter (no UI for roles in slice 0). */
export async function addMember(workspaceId: string, userId: string, role: WorkspaceRole, addedBy: string) {
  const now = new Date().toISOString();
  const ctx = { actorId: addedBy, now, newId: () => uuidv7() };
  const row = { workspace_id: workspaceId, user_id: userId, role, added_by: addedBy, created_at: now };
  const result = await createLocalDataStore(E2E_DB).apply(
    buildWriteSet(ctx, workspaceId, [{ kind: "insert", table: "workspace_member", row }]),
  );
  if (!result.ok) throw new Error(result.error.message);
}
