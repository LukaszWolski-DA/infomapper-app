import { expect, test, type Page } from "./fixtures";
import { SEED_IDS, signInAs } from "./helpers";

const crumbs = (page: Page) => page.getByTestId("breadcrumb");

test("S0-11: breadcrumbs show where you are on every page, and each part navigates", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const ws = SEED_IDS.wsRetailDwh;
  const projectUrl = `/w/${ws}/p/${SEED_IDS.projOrderManagement}`;
  const canvasUrl = `${projectUrl}/c/${SEED_IDS.canvasOrderLines}`;

  await expect(crumbs(page)).toHaveText(["InfoMate", "Retail Co – DWH", "Workspace home"]);

  await page.goto(projectUrl);
  await expect(crumbs(page)).toHaveText(["InfoMate", "Retail Co – DWH", "Order management", "Home"]);

  await page.goto(canvasUrl);
  await expect(crumbs(page)).toHaveText(["InfoMate", "Retail Co – DWH", "Order management", "Order lines & products"]);
  await expect(crumbs(page).last()).toHaveAttribute("aria-current", "page");

  const expectations: [number, string][] = [
    [0, `/w/${ws}`], // the organization opens its first workspace
    [1, `/w/${ws}`],
    [2, projectUrl],
    [3, canvasUrl],
  ];
  for (const [index, url] of expectations) {
    await page.goto(canvasUrl);
    await crumbs(page).nth(index).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
  }
});

test("S0-11: pages of a workspace you are not a member of do not exist", async ({ page }) => {
  await signInAs(page, "Piotr Wiśniewski");
  const res = await page.goto(`/w/${SEED_IDS.wsSales}`);
  expect(res?.status()).toBe(404);
});
