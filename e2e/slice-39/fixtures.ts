// Every slice 39 test starts from freshly seeded data (the plain seed: no organization holds the InfoCatalog licence,
// C5); a test grants it as test data (`grantCatalogLicence`). Extends `e2e/settle.ts` (fix/write-after-reseed).

import { test as base } from "../settle";
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
