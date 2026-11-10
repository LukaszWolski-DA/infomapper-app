// Every slice 22 test starts from freshly seeded data with everything the seed writes (`addFullDemoData`), as slice
// 20's: the Sales star with slice 18's derivations, slice 19's types and slice 20's checks demo. Every seeded dimension
// has its unknown member on and no stored value.

import { test as base } from "@playwright/test";
import { addFullDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  viewport: { width: 1536, height: 864 },
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB, addFullDemoData);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
