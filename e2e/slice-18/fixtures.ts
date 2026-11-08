// Every slice 18 test starts from freshly seeded data with the Sales star and slice 18's demo on it (item 5, F20):
// Dim Customer.country_name a Draft lookup from Country through Country → Customer Address ("Unknown"), Fact
// Sales.net_amount calculated from the fact's quantity, unit_price and discount_pct. Slice 15's fixtures keep the star
// without them.

import { test as base } from "@playwright/test";
import { addDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  viewport: { width: 1536, height: 864 },
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB, addDemoData);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
