import { expect, test } from "./fixtures";
import { createFromSwitcher, expectToast, newSession } from "./helpers";

test("S0-08: of two sessions saving settings from the same version, the second is refused and nothing is overwritten", async ({ browser }) => {
  // Marek creates a workspace of his own (Retail Co), which also covers "New workspace".
  const first = await newSession(browser, "Marek Lis");
  await createFromSwitcher(first.page, "switcher-workspace", "input-new-workspace", "Pricing");
  await expectToast(first.page, "Created the workspace Pricing.");
  await expect(first.page.getByTestId("switcher-workspace")).toHaveText("Pricing");
  await expect(first.page.getByTestId("switcher-project")).toHaveText("First project");
  const settingsUrl = first.page.url().replace(/\?.*$/, "") + "?tab=settings";

  const second = await newSession(browser, "Marek Lis");
  await first.page.goto(settingsUrl);
  await second.page.goto(settingsUrl);

  await first.page.getByTestId("input-workspace-name").fill("Pricing 2026");
  await first.page.getByTestId("input-workspace-name").press("Enter");
  await expectToast(first.page, "Settings saved.");

  await second.page.getByTestId("input-workspace-name").fill("Pricing (old)");
  await second.page.getByTestId("input-workspace-name").press("Enter");
  await expectToast(second.page, "Someone changed this meanwhile.");
  // the field keeps the typed name (slice 13, D-66); the refusal's fresh page shows the stored name elsewhere
  await expect(second.page.getByTestId("input-workspace-name")).toHaveValue("Pricing (old)");
  await expect(second.page.getByTestId("switcher-workspace")).toHaveText("Pricing 2026");

  await second.page.reload();
  await expect(second.page.getByTestId("input-workspace-name")).toHaveValue("Pricing 2026");
  await expect(second.page.getByTestId("switcher-workspace")).toHaveText("Pricing 2026");
});

test("S0-08: an empty name goes back, with the domain's message (D-59, slice 13)", async ({ browser }) => {
  const { page } = await newSession(browser, "Marek Lis");
  await page.goto(page.url().replace(/\?.*$/, "") + "?tab=settings");
  const name = page.getByTestId("input-workspace-name");
  const before = await name.inputValue();
  await name.fill("  ");
  await name.press("Enter");
  await expectToast(page, "Enter a name.");
  await expect(name).toHaveValue(before);
});
