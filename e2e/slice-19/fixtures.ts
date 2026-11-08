// Every slice 19 test starts from freshly seeded data with the Sales star, slice 18's derivations and slice 19's types
// (item 8): Fact Orders an aggregate of Fact Sales, Dim Category an outrigger of Dim Product ("groups"), Dim Order Flags a
// junk dimension, Dim Product a month-end snapshot. Slice 15's and 18's fixtures keep the star without them.

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
