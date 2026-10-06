// Before the tests: fresh seed data in the e2e file (so .data/dev-db.json is left alone), and a warm-up of the dev
// server. Each e2e run starts from an empty build folder, so the server compiles every page and action on first use;
// the warm-up signs in once and opens the main pages, so no test has to wait for a compile.
import { chromium } from "@playwright/test";
import { SEED_IDS } from "../src/data/local/seed";
import { resetDevData } from "../src/data/local/dev-data";
import { E2E_BASE, E2E_DB } from "./config";

export default async function globalSetup() {
  await resetDevData(E2E_DB);

  const base = E2E_BASE;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    await page.goto(`${base}/sign-in`);
    await page.getByTestId("button-dev-user").first().click();
    await page.getByTestId("bar-top").waitFor();
    const ws = SEED_IDS.wsRetailDwh, project = SEED_IDS.projCustomer360;
    for (const path of [`/w/${ws}`, `/w/${ws}?tab=settings`, `/w/${ws}/p/${project}`, `/w/${ws}/p/${project}/c/${SEED_IDS.canvasCustomerOrders}`]) {
      await page.goto(base + path);
      await page.getByTestId("bar-top").waitFor();
    }
  } finally {
    await browser.close();
  }
  await resetDevData(E2E_DB); // the warm-up wrote preferences only, but start every run from the same data
}
