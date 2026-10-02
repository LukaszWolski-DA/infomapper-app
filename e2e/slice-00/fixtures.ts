// Every slice 0 test starts from freshly seeded data: an automatic fixture resets the e2e data file before each
// test. The dev server reads the file on every request, so no test depends on what another test did or undid.

import { test as base } from "@playwright/test";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
