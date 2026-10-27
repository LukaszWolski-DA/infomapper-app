import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { SEED_IDS, signInWithPassword } from "./helpers";

/** Every page and action response's body, as the browser received it. */
function collectBodies(page: Page): string[] {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/text\/(html|x-component|plain)|json/.test(type)) return;
    try {
      bodies.push(await response.text());
    } catch {
      // a redirect or a response the page navigated away from has no body
    }
  });
  return bodies;
}

test("S8-13: no page's data and no action's result carries an organization's password hash", async ({ page }) => {
  const bodies = collectBodies(page);
  // the start page, its actions (the organization step, a wrong and a right password), the shell's pages
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill("lukasz@infomate.pl");
  await panel.getByTestId("button-sign-in-continue").click();
  await panel.getByTestId("button-sign-in-organization").filter({ hasText: "InfoMate" }).click();
  await panel.getByTestId("input-sign-in-password").fill("wrong-pass");
  await panel.getByTestId("button-sign-in").click();
  await expect(panel.getByTestId("message-start")).toBeVisible();
  await signInWithPassword(page, "lukasz@infomate.pl", "InfoMate");
  await page.goto(`/w/${SEED_IDS.wsRetailDwh}?tab=people`);
  await page.goto(`/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projCustomer360}`);
  await page.goto(`/sign-in?org=${SEED_IDS.orgRetailCo}`);
  await page.waitForLoadState("networkidle");

  expect(bodies.length).toBeGreaterThan(5);
  for (const body of bodies) expect(body).not.toContain("scrypt$");
  expect(bodies.join("\n")).not.toContain("access_hash");
});
