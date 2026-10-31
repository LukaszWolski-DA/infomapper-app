// Every slice 11 test starts from freshly seeded data: an automatic fixture resets the e2e data file before each
// test. The dev server reads the file on every request, so no test depends on what another test did or undid.

import { test as base } from "@playwright/test";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  // a window wide enough for the names' check boxes in the top bar: up to 1,300 px they are in “More” (step 4, S6A-10)
  viewport: { width: 1536, height: 864 },
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
